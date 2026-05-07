use std::env;
use std::io::Result;
use std::path::PathBuf;

fn main() -> Result<()> {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let proto_dir = PathBuf::from(&manifest_dir).join("../proto");
    let proto_dir = proto_dir.canonicalize().unwrap_or(proto_dir);

    prost_build::Config::new()
        .type_attribute(".", "#[allow(dead_code)]")
        .compile_protos(&[proto_dir.join("logger.proto")], &[proto_dir.as_path()])?;

    Ok(())
}
