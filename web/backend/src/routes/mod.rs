mod languages;
mod phrases;
mod questions;
mod settings;
mod tags;

use axum::Router;
use crate::AppState;

pub fn api_routes() -> Router<AppState> {
    Router::new()
        .merge(questions::routes())
        .merge(phrases::routes())
        .merge(tags::routes())
        .merge(languages::routes())
        .merge(settings::routes())
}
