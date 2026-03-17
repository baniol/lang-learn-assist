//! Safe lock utilities to prevent crashes from poisoned mutexes.
//!
//! Standard library mutexes can become "poisoned" if a thread panics while holding the lock.
//! Using `.unwrap()` on a poisoned mutex will crash the application. These traits provide
//! safe alternatives that return errors instead of panicking.

use std::sync::{Mutex, MutexGuard, RwLock, RwLockReadGuard, RwLockWriteGuard};

/// Extension trait for safely locking a Mutex without panicking on poison.
pub trait SafeLock<T> {
    /// Safely lock the mutex, returning an error if the mutex is poisoned.
    ///
    /// This is safer than `.lock().unwrap()` because it won't panic if
    /// another thread panicked while holding the lock.
    fn safe_lock(&self) -> Result<MutexGuard<'_, T>, String>;
}

impl<T> SafeLock<T> for Mutex<T> {
    fn safe_lock(&self) -> Result<MutexGuard<'_, T>, String> {
        self.lock().map_err(|e| format!("Mutex poisoned: {}", e))
    }
}

/// Extension trait for safely reading from an RwLock without panicking on poison.
pub trait SafeRwLock<T> {
    /// Safely acquire a read lock, returning an error if the lock is poisoned.
    fn safe_read(&self) -> Result<RwLockReadGuard<'_, T>, String>;

    /// Safely acquire a write lock, returning an error if the lock is poisoned.
    fn safe_write(&self) -> Result<RwLockWriteGuard<'_, T>, String>;
}

impl<T> SafeRwLock<T> for RwLock<T> {
    fn safe_read(&self) -> Result<RwLockReadGuard<'_, T>, String> {
        self.read()
            .map_err(|e| format!("RwLock poisoned (read): {}", e))
    }

    fn safe_write(&self) -> Result<RwLockWriteGuard<'_, T>, String> {
        self.write()
            .map_err(|e| format!("RwLock poisoned (write): {}", e))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use std::thread;

    #[test]
    fn test_safe_lock_success() {
        let mutex = Mutex::new(42);
        let guard = mutex.safe_lock().unwrap();
        assert_eq!(*guard, 42);
    }

    #[test]
    fn test_safe_rwlock_read_success() {
        let rwlock = RwLock::new(42);
        let guard = rwlock.safe_read().unwrap();
        assert_eq!(*guard, 42);
    }

    #[test]
    fn test_safe_rwlock_write_success() {
        let rwlock = RwLock::new(42);
        let mut guard = rwlock.safe_write().unwrap();
        *guard = 100;
        assert_eq!(*guard, 100);
    }

    #[test]
    fn test_safe_lock_poisoned() {
        let mutex = Arc::new(Mutex::new(42));
        let mutex_clone = Arc::clone(&mutex);

        // Spawn a thread that panics while holding the lock
        let handle = thread::spawn(move || {
            let _guard = mutex_clone.lock().unwrap();
            panic!("Intentional panic to poison mutex");
        });

        // Wait for the thread to panic
        let _ = handle.join();

        // Now safe_lock should return an error instead of panicking
        let result = mutex.safe_lock();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Mutex poisoned"));
    }
}
