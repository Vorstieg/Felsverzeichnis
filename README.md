# Felsverzeichnis

Felsverzeichnis is a web application designed to help climbers discover and explore climbing crags with detailed information and interactive visualizations. From comprehensive crag data to 3D models and sun exposure charts, Felsverzeichnis aims to be a valuable resource for planning climbing adventures.

**Current Version running at:** [felsverzeichnis.vorstieg.eu](https://felsverzeichnis.vorstieg.eu)

## Features

*   **Crag Discovery:** Browse and search for climbing crags.
*   **Detailed Crag Pages:** Access in-depth information about each crag, including location, public transport options, etc.
*   **3D Visualizations:** Explore crags and routes with interactive 3D models (where available).
*   **Route Editor:** Tools for creating and editing climbing routes.

## Development

To get started with development, follow these steps:

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
