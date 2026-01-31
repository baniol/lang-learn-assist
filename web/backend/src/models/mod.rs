mod phrase;
mod question;
mod tag;

pub use phrase::*;
pub use question::*;
pub use tag::*;

use uuid::Uuid;

/// Dev user ID for development (auth disabled)
pub const DEV_USER_ID: Uuid = uuid::uuid!("00000000-0000-0000-0000-000000000001");
