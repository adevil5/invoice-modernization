# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an invoice modernization project that transforms a legacy Python 2.7 invoice processing script into a cloud-native, event-driven service using:

- TypeScript with Node.js 22 LTS (v22.12.0+)
- AWS Lambda for serverless compute
- DynamoDB for data storage
- API Gateway for REST APIs
- EventBridge for event-driven architecture
- Terraform 1.12.2 for infrastructure as code

## Development Commands

### Initial Setup

```bash
# Install Node.js 22 LTS
nvm install --lts

# Initialize TypeScript project
npm init -y
npx tsc --init --target es2022 --module commonjs --strict

# Install core dependencies
npm i @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/client-eventbridge @aws-sdk/client-s3
npm i -D @types/aws-lambda jest @types/jest ts-jest esbuild
```

### Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- path/to/test.ts

# Run integration tests (requires LocalStack)
docker-compose up -d
npm run test:integration
```

### Building and Bundling

```bash
# Build TypeScript
npm run build

# Bundle Lambda functions with esbuild
npm run bundle

# Type checking
npm run typecheck
```

### Linting and Formatting

```bash
# Run ESLint
npm run lint

# Fix ESLint issues
npm run lint:fix

# Format with Prettier
npm run format
```

### Infrastructure Deployment

```bash
# Initialize Terraform
cd infrastructure/terraform
terraform init

# Plan changes
terraform plan -var-file=environments/dev.tfvars

# Apply changes
terraform apply -var-file=environments/dev.tfvars

# Switch workspace
terraform workspace select dev
```

## Architecture Overview

### Clean Architecture Layers

1. **Domain Layer** (`src/domain/`)
   - Pure business logic and rules
   - Invoice entities and value objects
   - Tax calculation service with strategy pattern
   - Validation rules and domain exceptions

2. **Application Layer** (`src/application/`)
   - Use cases: CreateInvoice, ProcessInvoice, QueryInvoice
   - Orchestrates domain logic
   - Defines port interfaces for infrastructure

3. **Infrastructure Layer** (`src/infrastructure/`)
   - DynamoDB repository implementation
   - S3 document storage
   - PDF generation with Puppeteer
   - EventBridge publisher
   - Structured logging with Winston

4. **Interfaces Layer** (`src/interfaces/`)
   - HTTP handlers for API Gateway
   - Event handlers for SQS/EventBridge
   - Input validation and error handling

### Key Design Patterns

- **Repository Pattern**: Abstract data access behind interfaces
- **Strategy Pattern**: For different tax calculation rules
- **Use Case Pattern**: Each business operation as a separate class
- **Ports and Adapters**: Clean separation between business logic and infrastructure

### Event-Driven Flow

1. CSV upload to S3 triggers Lambda
2. Lambda parses CSV and creates invoice records
3. Invoice creation publishes event to EventBridge
4. Processing Lambda generates PDF and stores in S3
5. Completion event published for downstream systems

### API Endpoints

- `POST /invoices` - Create new invoice (202 Accepted)
- `GET /invoices/{id}` - Get invoice details
- `GET /invoices` - List invoices with pagination
- `GET /health` - Health check endpoint

## Testing Strategy

- **Unit Tests**: Test domain logic and use cases in isolation
- **Integration Tests**: Test repository implementations with LocalStack
- **E2E Tests**: Test complete API flows
- **Legacy Parity Tests**: Ensure output matches legacy system

## Performance Considerations

- Lambda functions use esbuild for minimal cold starts
- DynamoDB configured with auto-scaling
- API Gateway with caching headers
- Circuit breaker pattern for external services

## Security Implementation

- API Gateway with API key authentication
- IAM roles with least privilege
- Audit logging for all operations
- Encryption at rest for DynamoDB and S3

## Migration Strategy

- Feature flags for gradual rollout
- Shadow mode for validation
- Blue-green deployments
- Automated rollback on errors
