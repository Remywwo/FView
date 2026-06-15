// Standalone smoke test for the HTML preview HTTP server.
// Verifies that relative-path resources, MIME types, and live content updates all work.

use std::fs;
use std::io::Read;
use std::net::TcpStream;
use std::path::Path;
use std::sync::{Arc, Mutex, mpsc};
use std::thread;
use std::time::Duration;

use tiny_http::{Header, Response, Server, StatusCode};

fn mime_for(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_lowercase())
        .as_deref()
    {
        Some("html") | Some("htm") => "text/html; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("js") | Some("mjs") => "application/javascript; charset=utf-8",
        Some("json") => "application/json; charset=utf-8",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("svg") => "image/svg+xml",
        _ => "application/octet-stream",
    }
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(h1), Some(h2)) = (
                (bytes[i + 1] as char).to_digit(16),
                (bytes[i + 2] as char).to_digit(16),
            ) {
                out.push((h1 * 16 + h2) as u8);
                i += 3;
                continue;
            }
        }
        if bytes[i] == b'+' {
            out.push(b' ');
        } else {
            out.push(bytes[i]);
        }
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn handle_request(
    req: tiny_http::Request,
    root: &Path,
    primary_name: &Path,
    primary_content: &Arc<Mutex<String>>,
) {
    let url = req.url().to_string();
    let path_str = url.split('?').next().unwrap_or("/").to_string();
    let decoded = percent_decode(&path_str);
    let rel = if decoded == "/" || decoded.is_empty() {
        primary_name.to_path_buf()
    } else {
        Path::new(&decoded.trim_start_matches('/')).to_path_buf()
    };
    let abs = root.join(&rel);
    let canonical_root = match root.canonicalize() {
        Ok(p) => p,
        Err(_) => {
            let _ = req.respond(
                Response::from_string("Internal Server Error").with_status_code(StatusCode(500)),
            );
            return;
        }
    };
    let canonical_abs = match abs.canonicalize() {
        Ok(p) => p,
        Err(_) => {
            let _ = req.respond(
                Response::from_string("Not Found").with_status_code(StatusCode(404)),
            );
            return;
        }
    };
    if !canonical_abs.starts_with(&canonical_root) {
        let _ = req.respond(
            Response::from_string("Forbidden").with_status_code(StatusCode(403)),
        );
        return;
    }

    let is_primary = canonical_abs.file_name() == primary_name.file_name();
    let result: Result<(Vec<u8>, &'static str), ()> = if is_primary {
        let content = primary_content.lock().unwrap().clone();
        Ok((content.into_bytes(), mime_for(&canonical_abs)))
    } else {
        match fs::read(&canonical_abs) {
            Ok(bytes) => Ok((bytes, mime_for(&canonical_abs))),
            Err(_) => Err(()),
        }
    };

    match result {
        Ok((data, mime)) => {
            let resp = Response::from_data(data)
                .with_header(Header::from_bytes(&b"Content-Type"[..], mime.as_bytes()).unwrap())
                .with_header(Header::from_bytes(&b"Cache-Control"[..], b"no-cache").unwrap());
            let _ = req.respond(resp);
        }
        Err(()) => {
            let _ = req.respond(
                Response::from_string("Not Found").with_status_code(StatusCode(404)),
            );
        }
    }
}

fn http_get(host: &str, port: u16, path: &str) -> (u16, String, String) {
    let mut stream = TcpStream::connect((host, port)).expect("connect");
    let req = format!(
        "GET {} HTTP/1.1\r\nHost: {}:{}\r\nConnection: close\r\n\r\n",
        path, host, port
    );
    use std::io::Write;
    stream.write_all(req.as_bytes()).unwrap();
    let mut buf = Vec::new();
    stream.read_to_end(&mut buf).unwrap();
    let s = String::from_utf8_lossy(&buf).into_owned();
    let mut parts = s.splitn(2, "\r\n\r\n");
    let head = parts.next().unwrap_or("");
    let body = parts.next().unwrap_or("").to_string();
    let status = head
        .lines()
        .next()
        .and_then(|l| l.split_whitespace().nth(1))
        .and_then(|n| n.parse().ok())
        .unwrap_or(0);
    let mut content_type = String::new();
    for line in head.lines() {
        if let Some(rest) = line.to_lowercase().strip_prefix("content-type:") {
            content_type = rest.trim().to_string();
        }
    }
    (status, content_type, body)
}

fn main() {
    let test_dir = "/tmp/html-preview-test";
    let html_path = format!("{}/index.html", test_dir);
    let root = Path::new(test_dir).to_path_buf();
    let primary_name = Path::new("index.html").to_path_buf();

    let server = Server::http("127.0.0.1:0").expect("bind");
    let port = match server.server_addr() {
        tiny_http::ListenAddr::IP(addr) => addr.port(),
        _ => panic!("unexpected addr"),
    };
    let initial = fs::read_to_string(&html_path).expect("read html");
    let content = Arc::new(Mutex::new(initial));
    let (tx, rx) = mpsc::channel::<()>();

    let content_clone = Arc::clone(&content);
    let primary_clone = primary_name.clone();
    let root_clone = root.clone();
    let handle = thread::spawn(move || {
        for req in server.incoming_requests() {
            if rx.try_recv().is_ok() {
                break;
            }
            handle_request(req, &root_clone, &primary_clone, &content_clone);
        }
    });

    println!("[smoke] server listening on 127.0.0.1:{}", port);

    // Test 1: GET / -> 200, text/html, contains expected content
    let (s, ct, body) = http_get("127.0.0.1", port, "/");
    assert_eq!(s, 200, "GET / status");
    assert!(ct.contains("text/html"), "GET / content-type: {}", ct);
    assert!(body.contains("FView"), "GET / body should contain FView: got {} bytes", body.len());
    println!("[smoke] PASS  GET /  -> 200 text/html, {} bytes", body.len());

    // Test 2: GET /styles.css -> 200, text/css
    let (s, ct, body) = http_get("127.0.0.1", port, "/styles.css");
    assert_eq!(s, 200, "GET /styles.css status");
    assert!(ct.contains("text/css"), "GET /styles.css content-type: {}", ct);
    assert!(body.contains("linear-gradient"), "GET /styles.css body");
    println!("[smoke] PASS  GET /styles.css -> 200 text/css, {} bytes", body.len());

    // Test 3: GET /preview.js -> 200, application/javascript
    let (s, ct, body) = http_get("127.0.0.1", port, "/preview.js");
    assert_eq!(s, 200, "GET /preview.js status");
    assert!(ct.contains("javascript"), "GET /preview.js content-type: {}", ct);
    assert!(body.contains("addEventListener"), "GET /preview.js body");
    println!("[smoke] PASS  GET /preview.js -> 200 js, {} bytes", body.len());

    // Test 4: GET /icon.svg -> 200, image/svg+xml
    let (s, ct, body) = http_get("127.0.0.1", port, "/icon.svg");
    assert_eq!(s, 200, "GET /icon.svg status");
    assert!(ct.contains("svg"), "GET /icon.svg content-type: {}", ct);
    assert!(body.contains("<svg"), "GET /icon.svg body");
    println!("[smoke] PASS  GET /icon.svg -> 200 svg, {} bytes", body.len());

    // Test 5: Path traversal -> canonicalize resolves `..`, file does not exist, returns 404
    // (the second-line defense in handle_request would return 403 if the path resolved
    //  to something outside the root, e.g., via a symlink)
    let (s, _ct, _body) = http_get("127.0.0.1", port, "/../etc/passwd");
    assert!(
        s == 403 || s == 404,
        "path traversal should be 403 or 404, got {}",
        s
    );
    println!(
        "[smoke] PASS  GET /../etc/passwd -> {} (path traversal blocked)",
        s
    );

    // Test 6: Missing file -> 404
    let (s, _ct, _body) = http_get("127.0.0.1", port, "/nonexistent.png");
    assert_eq!(s, 404, "missing file should be 404, got {}", s);
    println!("[smoke] PASS  GET /nonexistent.png -> 404");

    // Test 7: Live content update via in-memory buffer
    *content.lock().unwrap() = "<html><body><h1>LIVE UPDATE OK</h1></body></html>".to_string();
    thread::sleep(Duration::from_millis(100));
    let (s, _ct, body) = http_get("127.0.0.1", port, "/");
    assert_eq!(s, 200, "live update status");
    assert!(body.contains("LIVE UPDATE OK"), "live update content");
    println!("[smoke] PASS  live content update reflected in primary file");

    // Test 8: Primary file uses in-memory, non-primary uses disk
    let (s, ct, _body) = http_get("127.0.0.1", port, "/styles.css");
    assert_eq!(s, 200);
    assert!(ct.contains("text/css"));
    println!("[smoke] PASS  non-primary files still served from disk after live update");

    // Test 9: Stop the server (simulating the React unmount cleanup that calls
    // stop_html_server) and verify the port is no longer accepting connections.
    let _ = tx.send(());
    // Send a dummy request to wake up the incoming_requests() iterator so the
    // thread can observe the shutdown signal and break out.
    let _ = http_get("127.0.0.1", port, "/__shutdown__");
    // Give the server a moment to release the listener.
    thread::sleep(Duration::from_millis(150));
    // Try to connect to the now-freed port — must fail.
    use std::net::SocketAddr;
    let addr: SocketAddr = format!("127.0.0.1:{}", port).parse().unwrap();
    let still_up = TcpStream::connect_timeout(&addr, Duration::from_millis(200)).is_ok();
    assert!(
        !still_up,
        "port {} should be closed after stop_html_server",
        port
    );
    println!("[smoke] PASS  port {} closed after stop signal", port);

    // Test 10: After stop, a new server can be started on a (likely) different
    // port — verifies the lifecycle is clean and reusable.
    drop(handle);
    let server2 = Server::http("127.0.0.1:0").expect("bind 2");
    let port2 = match server2.server_addr() {
        tiny_http::ListenAddr::IP(addr) => addr.port(),
        _ => panic!("unexpected addr 2"),
    };
    assert_ne!(port, port2, "second bind should get a different port");
    let (tx2, rx2) = mpsc::channel::<()>();
    let handle2 = thread::spawn(move || {
        for req in server2.incoming_requests() {
            if rx2.try_recv().is_ok() {
                break;
            }
            let _ = req.respond(Response::from_string("ok").with_status_code(200));
        }
    });
    let (s, _, body) = http_get("127.0.0.1", port2, "/");
    assert_eq!(s, 200, "new server reachable");
    assert_eq!(body, "ok");
    println!(
        "[smoke] PASS  new server on port {} started and reachable after old one stopped",
        port2
    );
    let _ = tx2.send(());
    let _ = http_get("127.0.0.1", port2, "/__shutdown__");
    drop(handle2);

    println!("\n[smoke] all 10 tests passed ✅");
}
