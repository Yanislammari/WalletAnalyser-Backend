# WalletAnalyser Backend API

WalletAnalyser’s backend is the core service powering the entire platform.  
It handles portfolio analysis logic, API routing, database operations, and prepares the foundation for advanced financial insights, portfolio analytics, and administrative management.

While the frontend focuses on delivering a clean and intuitive user experience, the backend ensures data integrity, reliable calculations, and scalable processing of financial information.

As the platform evolves, this service will orchestrate all data-driven features of WalletAnalyser, from portfolio metrics to AI-powered insights.

---

## 🚀 Purpose of the Backend

The backend is designed to:

- Provide structured REST APIs for the WalletAnalyser ecosystem  
- Process and analyze portfolio data (stocks, ETFs, allocations)  
- Compute advanced financial metrics such as returns, volatility, Sharpe ratio, and portfolio performance  
- Manage users, portfolios, and administrative operations  
- Store and retrieve financial data using a PostgreSQL database  
- Interact with the database through **Prisma ORM**  
- Expose secure endpoints with proper authentication and CORS policies  
- Support integrations with external financial data providers  
- Prepare the architecture for future scalability and advanced analytics features  

The backend is designed to remain **modular, maintainable, and scalable**, ensuring that WalletAnalyser can evolve toward more advanced portfolio intelligence, automation, and AI-driven investment insights.

---

## 🛠️ Tech Stack

- **Node.js 20**
- **TypeScript**
- **Express**
- **PostgreSQL**
- **Docker** (multi-stage build)
- **Azure App Service**
- **Azure Container Registry (ACR)**
- **GitHub Actions** (CI/CD)
- **Terraform** (infrastructure provisioning)

---

## 📦 Running the Project Locally

Install dependencies:

```bash
npm install
```

Build the TypeScript project:

```bash
npm run build
```

Start the development server:

```bash
npm run dev
```

Start the production version:

```
npm start
```

The server runs on:

```
http://localhost:8080
```

(Or another port depending on your environment variables.)

---

## 🔧 Environment Variables

Create a `.env` file at the project root.

Required variables:

```
PORT=xxxx
FRONTEND_ADDRESS=xxxx
DATABASE_URL=xxxx
```

---

## 🧹 Code Linting & Formatting

ESLint (Flat Config) and Prettier are used to maintain a consistent and professional codebase.

Run linting:

```bash
npm run lint
```

Format the code before pushing:

```bash
npm run format
```

---

## 🐳 Docker Support

Build the Docker image:

```bash
docker build -t walletanalyser-backend .
```

Run the container:

```bash
docker run -p 8080:8080 walletanalyser-backend
```

The Dockerfile uses a multi-stage build:
- Stage 1: TypeScript compilation
- Stage 2: Lightweight production runtime

---

## ☁️ Azure Deployment (CI/CD)

A GitHub Actions pipeline automatically:

1. Checks out the repository  
2. Logs into Azure  
3. Logs into the Azure Container Registry  
4. Builds the backend Docker image  
5. Pushes the latest tag to ACR  
6. Restarts the Azure App Service to pull and run the new image  

Terraform ensures the App Service is always configured to pull the latest image from ACR.

---

## 📄 Available Commands

`npm install`  
`npm run dev`   
`npm run build`  
`npm start`  
`npm run lint`  
`npm run format`   

---
