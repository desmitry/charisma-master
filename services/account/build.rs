use std::env;
use std::io::Result;
use std::path::PathBuf;

fn main() -> Result<()> {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let proto_dir = PathBuf::from(&manifest_dir).join("../../packages/proto");
    let proto_dir = proto_dir.canonicalize().unwrap_or(proto_dir);

    prost_build::Config::new()
        .type_attribute(".", "#[allow(dead_code)]")
        .compile_protos(
            &[
                proto_dir.join("common.proto"),
                proto_dir.join("account/users.proto"),
                proto_dir.join("account/credentials.proto"),
                proto_dir.join("account/permissions.proto"),
                proto_dir.join("logger.proto"),
            ],
            &[proto_dir.join("account"), proto_dir.clone()],
        )?;
    Ok(())
}
