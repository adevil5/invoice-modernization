# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an invoice modernization project that transforms a legacy Python 2.7 invoice processing script into a cloud-native, event-driven service using:

- TypeScript with Node.js 22 LTS (v22.12.0+) and ES Modules (ESM)
- AWS Lambda for serverless compute
- DynamoDB for data storage
- API Gateway for REST APIs
- EventBridge for event-driven architecture
- Terraform 1.12.2 for infrastructure as code

## Quick Start

```bash
# Install correct Node version
nvm install  # Uses .nvmrc

# Install dependencies
npm install

# Run essential checks
npm run lint
npm run typecheck
npm test
```

## Architecture Overview

### Clean Architecture Layers

1. **Domain Layer** (`src/domain/`)
   - Pure business logic and entities
   - Value objects: Money, Address, Customer, TaxRule
   - Immutable objects with defensive copying
   - Rich domain model pattern

2. **Application Layer** (`src/application/`)
   - Use cases orchestrating domain logic
   - Port interfaces for infrastructure

3. **Infrastructure Layer** (`src/infrastructure/`)
   - AWS service implementations
   - Repository pattern for data access

4. **Interfaces Layer** (`src/interfaces/`)
   - HTTP/Event handlers
   - Input validation

### Key Patterns
- Repository Pattern with DynamoDB (includes pagination and filtering)
- Query Use Cases with DTO transformations
- Strategy Pattern for tax calculation
- Value Objects for data integrity
- Comprehensive error hierarchy
- Port-Adapter pattern for infrastructure abstraction
- Fire-and-forget event publishing for resilience
- Modular Terraform infrastructure

### Event Flow
1. CSV upload → S3 → Lambda
2. Parse CSV → Create Invoice → EventBridge
3. Process Invoice → Generate PDF → S3
4. Publish completion event

### API Flow
1. REST API → API Gateway → Lambda
2. Query validation → Use Case → Repository
3. DynamoDB query with GSIs → DTO transformation
4. Paginated response with cursor

## Essential Commands

```bash
# Development
npm run dev           # Watch mode with instant rebuilds
npm run build         # Production build with esbuild
npm run build:dev     # Development build
npm run build:analyze # Build and view bundle analysis
npm test              # Run tests
npm run test:coverage # Test coverage

# Code Quality (run before commits)
npm run lint:fix      # Fix linting issues
npm run typecheck     # Type checking
npm run format        # Format code

# Infrastructure
cd infrastructure/terraform
terraform workspace select dev
terraform get  # Download modules
terraform validate  # Validate configuration
terraform apply -var-file=environments/dev.tfvars

# API Testing
npm run local:api     # Test API locally with SAM
curl http://localhost:3000/invoices?customerId=CUST123
```

## Critical Configuration

### TypeScript/ESM Setup
- **Build System**: esbuild handles all bundling and module resolution
- Target: ES2022, Module: ES2022, ModuleResolution: node
- Path aliases configured in tsconfig.json
- Jest configured with ts-jest for testing
- esbuild bundles all code for Lambda deployment with ESM output

### Business Rules
- Minimum invoice: $25
- Bulk discount: 3% for 100+ items
- Tax: State rates + Q4 adjustment (+2% Oct-Dec)
- Customer tax override takes precedence
- Invoice status: Pending (default), Paid (paid_at set), Overdue (15+ days unpaid)
- Query defaults: 90-day date range, 20 item limit

### Performance
- ES modules: ~43.5% better cold starts
- esbuild bundling: ~97% smaller packages (12KB bundles)
- Build time: <0.2s (88% faster than tsc)
- Immutable value objects in hot paths

### Security
- No sensitive data in errors
- Input validation in constructors
- Value objects ensure data integrity

## Documentation References

For detailed information, see:

- **Development Guide**: [`docs/development-guide.md`](docs/development-guide.md)
  - Complete command reference
  - Testing strategies
  - Debugging techniques
  - Troubleshooting

- **Infrastructure Guide**: [`docs/infrastructure.md`](docs/infrastructure.md)
  - Terraform deployment
  - AWS resource configuration
  - Monitoring and alerts
  - Disaster recovery

- **Domain Patterns**: [`docs/domain-patterns.md`](docs/domain-patterns.md)
  - Value object implementations
  - Error handling patterns
  - Business rule details
  - Legacy compatibility

- **Application Patterns**: [`docs/application-patterns.md`](docs/application-patterns.md)
  - Port-adapter implementations
  - Use case patterns
  - Event publishing strategies
  - Testing approaches

- **Legacy Analysis**: [`docs/legacy-analysis.md`](docs/legacy-analysis.md)
  - Original system behavior
  - Migration considerations

## Development Workflow

1. **Before coding**: Check existing patterns in codebase
2. **Use value objects**: Money, Address, etc. for domain data
3. **Handle errors**: Use appropriate error classes
4. **Test thoroughly**: Aim for 100% domain coverage
5. **Before committing**: Run lint, typecheck, and tests

## Build System

The project uses esbuild for bundling Lambda functions:
- Automatic entry point discovery for Lambda handlers
- Path alias resolution (@domain, @application, etc.)
- External AWS SDK to use Lambda runtime version
- Source maps for debugging
- Watch mode for development (`npm run dev`)

## Important Notes

- **ESM Imports**: No `.js` extensions needed in source code
- **Node Version**: Use v22.12.0+ (check .nvmrc)
- **Legacy Format**: CSV must match Python 2.7 output exactly
- **Tax Logic**: State rates with Q4 adjustment and customer overrides
- **Validation**: Collect all errors before throwing (no fail-fast)
- **Date Handling**: Parse dates at noon local time to avoid timezone issues
- **Event Publishing**: Failures are logged but don't fail the main operation
- **Correlation IDs**: Use optional spread pattern for proper TypeScript typing
- **Terraform Modules**: Use workspace-based environment separation
- **API Pagination**: Cursor-based with configurable limits (max 100)
- **Query Patterns**: Use GSIs for efficient filtering by customer, status, date