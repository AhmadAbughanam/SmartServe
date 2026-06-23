# Contributing

We welcome contributions to the Smart Restaurant OS project! Please follow these guidelines to ensure a smooth and effective contribution process.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior.

## How to Contribute

1.  **Fork the repository** on GitHub.
2.  **Clone your fork** locally: `git clone https://github.com/your-username/smart-restaurant-os.git`
3.  **Create a new branch** for your feature or bug fix: `git checkout -b my-new-feature`
4.  **Set up your development environment** by following the [Local Development Guide](./10_local_development.md).
5.  **Make your changes**.
6.  **Run tests** to ensure your changes don't break anything: `npm run test:critical` and `npm run e2e`.
7.  **Commit your changes** with a descriptive commit message. We follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification.
8.  **Push your branch** to your fork: `git push origin my-new-feature`
9.  **Open a pull request** to the `main` branch of the original repository.

## Commit Messages

We use Conventional Commits for our commit messages. The format is:

```
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

**Example:**

```
feat(api): add endpoint for listing menu items
```

Common types include: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

## Running Tests

-   **Backend critical tests:** `npm run test:critical`
-   **End-to-end tests:** `npm run e2e`
-   **Type checking:** `npm run typecheck`

Please ensure all tests pass before submitting a pull request.
