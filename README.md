# Felsverzeichnis

Felsverzeichnis is a web application designed to help climbers discover and explore climbing crags with detailed information and interactive visualizations. From comprehensive crag data to 3D models and sun exposure charts, Felsverzeichnis aims to be a valuable resource for planning climbing adventures.

**Current Version running at:** [felsverzeichnis.vorstieg.eu](https://felsverzeichnis.vorstieg.eu)

## Features

- **Crag Discovery:** Browse and search for climbing crags.
- **Detailed Crag Pages:** Access in-depth information about each crag, including location, public transport options, etc.
- **3D Visualizations:** Explore crags and routes with interactive 3D models (where available).
- **Route Editor:** Tools for creating and editing climbing routes.

## Development

### Dev Container (Recommended)

This project includes a Dev Container configuration (`.devcontainer`) for VS Code, IntelliJ IDEA, and GitHub Codespaces:

- Includes **Node.js 22**, Git, GitHub CLI (`gh`), and Playwright Chromium system dependencies.
- Automatic port forwarding for Vite dev server (`http://localhost:5173`) and preview (`http://localhost:4173`).
- Configures extensions and formatting for Svelte, Tailwind CSS, Prettier, and ESLint.

> **Note on `@vorstieg` packages:** Project dependencies include packages hosted on GitHub Packages (`npm.pkg.github.com`). Before or after launching the container, configure authentication:
>
> 1. Copy `.npmrc.example` to `.npmrc`:
>    ```bash
>    cp .npmrc.example .npmrc
>    ```
> 2. Add your GitHub Personal Access Token (with `read:packages` permission) or export `NODE_AUTH_TOKEN`.
> 3. Run `npm install`.

### Local Development

To get started with local development, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/Felsverzeichnis.git
    cd Felsverzeichnis
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or pnpm install
    # or yarn install
    ```
3.  **Start the development server:**

    ```bash
    npm run dev
    # or start the server and open the app in a new browser tab
    npm run dev -- --open
    ```

    The application will be available at `http://localhost:5173`.

4.  **Building for production:**

    ```bash
    npm run build
    ```

    You can preview the production build with `npm run preview`.

5.  **Linting and Formatting:**
    ```bash
    npm run lint
    npm run format
    ```

## Contributing

We welcome contributions to Felsverzeichnis! If you're interested in improving the project, please follow these general steps:

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix: `git checkout -b feature/your-feature-name`.
3.  Make your changes and ensure they adhere to the project's coding standards.
4.  Commit your changes: `git commit -m "feat: Add new feature"`
5.  Push to your branch: `git push origin feature/your-feature-name`
6.  Open a Pull Request to the `main` branch of the original repository.

Please make sure to test your changes thoroughly before submitting a pull request.

## Topo Creator

Felsverzeichnis includes a "Topo Creator" tool that allows users to generate 3D models and associated data for climbing crags. This tool is designed to facilitate the creation of detailed visualizations for new crags.

If you have used the Topo Creator to generate files for a new crag and would like to see it integrated into Felsverzeichnis, you can send the generated files directly to [robin.steiner@vorstieg.eu](mailto://robin.steiner@vorstieg.eu). There is no need to open a Pull Request for these types of contributions; they will be added manually.

## Custom map overlay

Terrain and transport maps display OSM via ferrata and hiking difficulty tiles
served by Felslager at `/api/tiles/via-ferrata.pmtiles`. Build the archive in
Felslager using `npm run build:via-ferrata` and keep its `TILES_DIR` persistent.
Felsverzeichnis uses the [PMTiles MapLibre protocol](https://docs.protomaps.com/pmtiles/maplibre)
to read byte ranges directly from that service; it does not generate or host tiles.

The archive URL defaults to the Felslager origin configured in `PUBLIC_FS_API_URL`
(default `https://lager.felsverzeichnis.at/api/fs`). For a separate tile host,
set `PUBLIC_VIA_FERRATA_TILES_URL` to the full HTTP(S) archive URL. The tile host
must support ranges and CORS. The overlay covers Austria from zoom 10 upward.
