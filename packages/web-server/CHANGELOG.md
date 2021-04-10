# 3.0.0-beta.90

- `@Mount()` now places the controller instance into the field that has `@Mount()` on it, which is more intuitive and allows the parent controller to configure the child controller directly
- The ability to mount multiple controllers in a single `@Mount()` decorator has been removed to better align with Transparent Services