# Backup Observatory - Frontend

The frontend is a Next.js application that provides a sleek, real-time dashboard for monitoring the GitHub Backup Observatory. It displays backup runs, historical metrics, and streams live logs via WebSockets.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (v16)
- **UI Library**: [React](https://react.dev/) (v19)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (v4)
- **Linting & Formatting**: [Biome](https://biomejs.dev/)
- **Charts**: Recharts
- **Icons**: Lucide React

## Getting Started

This project uses `pnpm` as its package manager.

### Prerequisites
- Node.js (v18+)
- `pnpm` installed (`npm install -g pnpm`)

### Installation

Navigate to the `frontend` directory and install dependencies:

```bash
cd frontend

# Update dependencies and install
pnpm up -Lr

# Install dependencies
pnpm install
```

### Environment Variables
Copy `.env.local` if it exists, or ensure your environment variables are configured to point to the Backend API. Typical variables include the API URL for REST and WebSocket connections.

### Running Locally

Start the development server:

```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

## Development Scripts

- `pnpm run dev`: Starts the Next.js development server.
- `pnpm run build`: Builds the application for production.
- `pnpm run start`: Starts the Next.js production server.
- `pnpm run lint`: Runs Biome to check for linting errors.
- `pnpm run format`: Runs Biome to auto-format code.

## Folder Structure

- `src/`: Contains all Next.js app router files, components, and hooks.
- `biome.json`: Configuration for the Biome linter/formatter.
- `next.config.ts`: Next.js configuration file.
