use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, mpsc};
use std::thread;

use tiny_http::{Header, Response, Server, StatusCode};

#[tauri::command]
fn get_cli_file() -> Option<String> {
    for arg in std::env::args().skip(1) {
        if arg == "--" {
            continue;
        }
        if !arg.starts_with('-') {
            let p = PathBuf::from(&arg);
            if p.exists() {
                return Some(arg);
            }
        }
    }
    None
}

// =============================================================================
// Local HTTP server for HTML preview
// =============================================================================

#[allow(dead_code)]
struct HtmlServerState {
    port: u16,
    file_path: PathBuf,
    primary_name: PathBuf,
    root: PathBuf,
    content: Arc<Mutex<String>>,
    shutdown_tx: mpsc::Sender<()>,
}

static HTML_SERVER: Mutex<Option<HtmlServerState>> = Mutex::new(None);

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
        Some("webp") => "image/webp",
        Some("svg") => "image/svg+xml",
        Some("ico") => "image/x-icon",
        Some("woff") => "font/woff",
        Some("woff2") => "font/woff2",
        Some("ttf") => "font/ttf",
        Some("otf") => "font/otf",
        Some("txt") => "text/plain; charset=utf-8",
        Some("md") | Some("markdown") => "text/markdown; charset=utf-8",
        Some("xml") => "application/xml; charset=utf-8",
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

fn stop_existing_server() {
    if let Ok(mut guard) = HTML_SERVER.lock() {
        if let Some(state) = guard.take() {
            let _ = state.shutdown_tx.send(());
        }
    }
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
        PathBuf::from(decoded.trim_start_matches('/'))
    };
    let abs = root.join(&rel);

    // Path traversal protection
    let canonical_root = match root.canonicalize() {
        Ok(p) => p,
        Err(_) => {
            let _ = req.respond(
                Response::from_string("Internal Server Error")
                    .with_status_code(StatusCode(500)),
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

    // If this is the primary HTML, serve in-memory content; otherwise read from disk
    let is_primary = canonical_abs.file_name() == primary_name.file_name();
    let result: Result<(Vec<u8>, &'static str), ()> = if is_primary {
        let content = primary_content.lock().unwrap().clone();
        let mime = mime_for(&canonical_abs);
        Ok((content.into_bytes(), mime))
    } else {
        match fs::read(&canonical_abs) {
            Ok(bytes) => Ok((bytes, mime_for(&canonical_abs))),
            Err(_) => Err(()),
        }
    };

    match result {
        Ok((data, mime)) => {
            let resp = Response::from_data(data)
                .with_header(
                    Header::from_bytes(&b"Content-Type"[..], mime.as_bytes()).unwrap(),
                )
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

#[tauri::command]
fn start_html_server(html_path: String, initial_content: String) -> Result<u16, String> {
    stop_existing_server();

    let html_path = PathBuf::from(&html_path);
    if !html_path.exists() {
        return Err(format!("File does not exist: {}", html_path.display()));
    }
    let root = html_path
        .parent()
        .ok_or_else(|| "Cannot determine parent directory".to_string())?
        .to_path_buf();
    let primary_name = html_path
        .file_name()
        .ok_or_else(|| "Cannot determine file name".to_string())?
        .to_os_string();
    let primary_path = PathBuf::from(primary_name);

    let server = Server::http("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = match server.server_addr() {
        tiny_http::ListenAddr::IP(addr) => addr.port(),
        #[allow(unreachable_patterns)]
        _ => return Err("Could not determine bound port".to_string()),
    };

    let content = Arc::new(Mutex::new(initial_content));
    let (shutdown_tx, shutdown_rx) = mpsc::channel::<()>();

    let content_clone = Arc::clone(&content);
    let primary_clone = primary_path.clone();
    let root_clone = root.clone();

    thread::spawn(move || {
        for req in server.incoming_requests() {
            if shutdown_rx.try_recv().is_ok() {
                break;
            }
            handle_request(req, &root_clone, &primary_clone, &content_clone);
        }
    });

    {
        let mut guard = HTML_SERVER.lock().unwrap();
        *guard = Some(HtmlServerState {
            port,
            file_path: html_path,
            primary_name: primary_path,
            root,
            content,
            shutdown_tx,
        });
    }

    Ok(port)
}

#[tauri::command]
fn update_html_preview_content(content: String) -> Result<(), String> {
    let guard = HTML_SERVER.lock().unwrap();
    if let Some(state) = guard.as_ref() {
        *state.content.lock().unwrap() = content;
        Ok(())
    } else {
        Err("Server not running".to_string())
    }
}

#[tauri::command]
fn stop_html_server() {
    stop_existing_server();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_cli_file,
            start_html_server,
            update_html_preview_content,
            stop_html_server,
        ])
        .setup(|app| {
            use tauri::{Emitter, WebviewUrl, WebviewWindowBuilder};

            // ── Native macOS menu bar ─────────────────────────────
            // macOS exposes a global menu bar at the top of the screen; on
            // Windows / Linux the app has no equivalent desktop surface, so
            // building and registering the menu there is pointless and would
            // leave accelerators with no UI. macOS-only.
            #[cfg(target_os = "macos")]
            {
                use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};

                let file_menu = SubmenuBuilder::new(app, "File")
                    .item(&MenuItemBuilder::with_id("open", "Open File…")
                        .accelerator("CmdOrCtrl+O")
                        .build(app)?)
                    .item(&MenuItemBuilder::with_id("open_folder", "Open Folder…")
                        .accelerator("CmdOrCtrl+Shift+O")
                        .build(app)?)
                    .separator()
                    .item(&MenuItemBuilder::with_id("save", "Save")
                        .accelerator("CmdOrCtrl+S")
                        .build(app)?)
                    .item(&MenuItemBuilder::with_id("save_as", "Save As…")
                        .accelerator("CmdOrCtrl+Shift+S")
                        .build(app)?)
                    .separator()
                    .item(&MenuItemBuilder::with_id("close", "Close")
                        .accelerator("CmdOrCtrl+W")
                        .build(app)?)
                    .build()?;

                let menu = MenuBuilder::new(app)
                    .item(&file_menu)
                    .build()?;
                app.set_menu(menu)?;

                app.on_menu_event(|app_handle, event| {
                    let id: &str = event.id().0.as_ref();
                    match id {
                        "open" => { let _ = app_handle.emit("menu-file-open", ()); }
                        "open_folder" => { let _ = app_handle.emit("menu-file-open-folder", ()); }
                        "save" => { let _ = app_handle.emit("menu-file-save", ()); }
                        "save_as" => { let _ = app_handle.emit("menu-file-save-as", ()); }
                        "close" => { let _ = app_handle.emit("menu-file-close", ()); }
                        _ => {}
                    }
                });
            }

            // ── Window ───────────────────────────────────────────
            #[cfg(target_os = "macos")]
            {
                WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                    .title("FView Power")
                    .inner_size(1440.0, 900.0)
                    .min_inner_size(600.0, 400.0)
                    .resizable(true)
                    .center()
                    .decorations(true)
                    .hidden_title(true)
                    .title_bar_style(tauri::TitleBarStyle::Overlay)
                    .traffic_light_position(tauri::LogicalPosition::new(12.0, 18.0))
                    .build()?;
            }

            #[cfg(not(target_os = "macos"))]
            {
                WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                    .title("FView Power")
                    .inner_size(1440.0, 900.0)
                    .min_inner_size(600.0, 400.0)
                    .resizable(true)
                    .center()
                    .decorations(true)
                    .build()?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
