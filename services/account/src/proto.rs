pub mod account {
    pub mod users {
        include!(concat!(env!("OUT_DIR"), "/account.users.rs"));
    }
    pub mod credentials {
        include!(concat!(env!("OUT_DIR"), "/account.credentials.rs"));
    }
    pub mod permissions {
        include!(concat!(env!("OUT_DIR"), "/account.permissions.rs"));
    }
}

pub mod common {
    include!(concat!(env!("OUT_DIR"), "/common.rs"));
}
