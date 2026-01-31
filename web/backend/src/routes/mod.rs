mod phrases;
mod questions;
mod tags;

use axum::Router;
use crate::AppState;

pub fn api_routes() -> Router<AppState> {
    Router::new()
        .merge(questions::routes())
        .merge(phrases::routes())
        .merge(tags::routes())
}
