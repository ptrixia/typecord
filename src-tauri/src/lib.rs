use keyring::Entry;
#[cfg_attr(mobile, tauri::mobile_entry_point)]
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, WebviewWindow};

#[derive(Serialize)]
struct AppInfo {
    name: String,
    version: String,
    platform: String,
    debug: bool,
}

#[derive(Serialize)]
struct OpenApplication {
    name: String,
    pid: String,
}

const KEYRING_SERVICE: &str = "com.typecord.desktop";
const APP_PIN_ACCOUNT: &str = "app-pin-hash-v1";

fn pin_hash(pin: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(b"typecord-app-pin-v1:");
    hasher.update(pin.as_bytes());
    hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn validate_pin(pin: &str) -> Result<(), String> {
    if !(4..=12).contains(&pin.len()) || !pin.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err("O PIN deve conter entre 4 e 12 dígitos.".to_string());
    }
    Ok(())
}

#[tauri::command]
fn get_secure_secret(account: String) -> Result<Option<String>, String> {
    let entry = Entry::new(KEYRING_SERVICE, &account).map_err(|error| error.to_string())?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn set_secure_secret(account: String, value: String) -> Result<(), String> {
    if account.len() < 8 || account.len() > 256 || value.len() > 64 * 1024 {
        return Err("Dados do cofre inválidos.".to_string());
    }
    let entry = Entry::new(KEYRING_SERVICE, &account).map_err(|error| error.to_string())?;
    entry
        .set_password(&value)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_secure_secret(account: String) -> Result<(), String> {
    let entry = Entry::new(KEYRING_SERVICE, &account).map_err(|error| error.to_string())?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn has_app_pin() -> Result<bool, String> {
    let entry = Entry::new(KEYRING_SERVICE, APP_PIN_ACCOUNT).map_err(|error| error.to_string())?;
    match entry.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn set_app_pin(pin: String) -> Result<(), String> {
    validate_pin(&pin)?;
    let entry = Entry::new(KEYRING_SERVICE, APP_PIN_ACCOUNT).map_err(|error| error.to_string())?;
    entry
        .set_password(&pin_hash(&pin))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn verify_app_pin(pin: String) -> Result<bool, String> {
    validate_pin(&pin)?;
    let entry = Entry::new(KEYRING_SERVICE, APP_PIN_ACCOUNT).map_err(|error| error.to_string())?;
    match entry.get_password() {
        Ok(expected) => Ok(expected == pin_hash(&pin)),
        Err(keyring::Error::NoEntry) => Ok(true),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn clear_app_pin() -> Result<(), String> {
    let entry = Entry::new(KEYRING_SERVICE, APP_PIN_ACCOUNT).map_err(|error| error.to_string())?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn get_app_info(app: AppHandle) -> AppInfo {
    AppInfo {
        name: app.package_info().name.clone(),
        version: app.package_info().version.to_string(),
        platform: std::env::consts::OS.to_string(),
        debug: cfg!(debug_assertions),
    }
}

#[tauri::command]
fn get_open_applications() -> Result<Vec<OpenApplication>, String> {
    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("tasklist")
            .args(["/FO", "CSV", "/NH"])
            .output()
            .map_err(|error| error.to_string())?;
        let text = String::from_utf8_lossy(&output.stdout);
        let mut applications = Vec::new();
        for line in text.lines() {
            let fields: Vec<&str> = line
                .split(',')
                .map(|value| value.trim_matches('"'))
                .collect();
            if fields.len() < 2
                || fields[0].eq_ignore_ascii_case("System Idle Process")
                || fields[0].eq_ignore_ascii_case("System")
            {
                continue;
            }
            if !applications
                .iter()
                .any(|item: &OpenApplication| item.name.eq_ignore_ascii_case(fields[0]))
            {
                applications.push(OpenApplication {
                    name: fields[0].to_string(),
                    pid: fields[1].to_string(),
                });
            }
        }
        applications
            .sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
        return Ok(applications);
    }
    #[cfg(target_os = "macos")]
    {
        let output = std::process::Command::new("ps")
            .args(["-axo", "pid=,comm="])
            .output()
            .map_err(|error| error.to_string())?;
        let text = String::from_utf8_lossy(&output.stdout);
        let mut applications = Vec::new();
        for line in text.lines() {
            let mut fields = line.trim().splitn(2, char::is_whitespace);
            let pid = fields.next().unwrap_or("").trim();
            let name = fields.next().unwrap_or("").trim();
            if pid.is_empty() || name.is_empty() || name == "kernel_task" {
                continue;
            }
            let name = name.rsplit('/').next().unwrap_or(name);
            if !applications
                .iter()
                .any(|item: &OpenApplication| item.name.eq_ignore_ascii_case(name))
            {
                applications.push(OpenApplication {
                    name: name.to_string(),
                    pid: pid.to_string(),
                });
            }
        }
        applications
            .sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
        return Ok(applications);
    }
    #[cfg(target_os = "linux")]
    {
        let output = std::process::Command::new("ps")
            .args(["-eo", "pid=,comm="])
            .output()
            .map_err(|error| error.to_string())?;
        let text = String::from_utf8_lossy(&output.stdout);
        let mut applications = Vec::new();
        for line in text.lines() {
            let mut fields = line.trim().splitn(2, char::is_whitespace);
            let pid = fields.next().unwrap_or("").trim();
            let name = fields.next().unwrap_or("").trim();
            if pid.is_empty() || name.is_empty() || name == "systemd" {
                continue;
            }
            if !applications
                .iter()
                .any(|item: &OpenApplication| item.name.eq_ignore_ascii_case(name))
            {
                applications.push(OpenApplication {
                    name: name.to_string(),
                    pid: pid.to_string(),
                });
            }
        }
        applications
            .sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
        return Ok(applications);
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Ok(Vec::new())
    }
}

#[tauri::command]
async fn set_window_mode(window: WebviewWindow, mode: String) -> Result<(), String> {
    match mode.as_str() {
        "minimize" => window.minimize().map_err(|error| error.to_string()),
        "maximize" => window.maximize().map_err(|error| error.to_string()),
        "unmaximize" => window.unmaximize().map_err(|error| error.to_string()),
        "toggle-maximize" => {
            if window.is_maximized().map_err(|error| error.to_string())? {
                window.unmaximize().map_err(|error| error.to_string())
            } else {
                window.maximize().map_err(|error| error.to_string())
            }
        }
        "close" => window.close().map_err(|error| error.to_string()),
        _ => Err("Modo de janela inválido.".to_string()),
    }
}

#[cfg(windows)]
#[tauri::command]
async fn verify_app_biometric() -> Result<bool, String> {
    use windows::core::HSTRING;
    use windows::Security::Credentials::UI::{
        UserConsentVerificationResult, UserConsentVerifier, UserConsentVerifierAvailability,
    };

    let availability = UserConsentVerifier::CheckAvailabilityAsync()
        .map_err(|error| error.to_string())?
        .get()
        .map_err(|error| error.to_string())?;

    if availability != UserConsentVerifierAvailability::Available {
        return Ok(false);
    }

    let result = UserConsentVerifier::RequestVerificationAsync(&HSTRING::from(
        "Confirme sua identidade para desbloquear o Typecord",
    ))
    .map_err(|error| error.to_string())?
    .get()
    .map_err(|error| error.to_string())?;

    Ok(result == UserConsentVerificationResult::Verified)
}

#[cfg(not(windows))]
#[tauri::command]
async fn verify_app_biometric() -> Result<bool, String> {
    Ok(false)
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            get_open_applications,
            set_window_mode,
            get_secure_secret,
            set_secure_secret,
            delete_secure_secret,
            has_app_pin,
            set_app_pin,
            verify_app_pin,
            clear_app_pin,
            verify_app_biometric
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
