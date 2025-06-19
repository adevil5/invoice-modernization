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
- Repository Pattern with DynamoDB
- Strategy Pattern for tax calculation
- Value Objects for data integrity
- Comprehensive error hierarchy

### Event Flow
1. CSV upload → S3 → Lambda
2. Parse CSV → Create Invoice → EventBridge
3. Process Invoice → Generate PDF → S3
4. Publish completion event

## Essential Commands

```bash
# Development
npm run build          # Build TypeScript
npm run bundle         # Bundle for Lambda
npm test              # Run tests
npm run test:coverage # Test coverage

# Code Quality (run before commits)
npm run lint:fix      # Fix linting issues
npm run typecheck     # Type checking
npm run format        # Format code

# Infrastructure
cd infrastructure/terraform
terraform workspace select dev
terraform apply -var-file=environments/dev.tfvars
```

## Critical Configuration

### TypeScript/ESM Setup
- **ALWAYS** use `.js` extensions in imports
- Target: ES2022, Module: ES2022
- Path aliases configured in tsconfig.json
- Jest configured for ESM

### Business Rules
- Minimum invoice: $25
- Bulk discount: 3% for 100+ items
- Tax: State rates + Q4 adjustment (+2% Oct-Dec)
- Customer tax override takes precedence

### Performance
- ES modules: ~43.5% better cold starts
- esbuild bundling: ~50% smaller packages
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

- **Legacy Analysis**: [`docs/legacy-analysis.md`](docs/legacy-analysis.md)
  - Original system behavior
  - Migration considerations

## Development Workflow

1. **Before coding**: Check existing patterns in codebase
2. **Use value objects**: Money, Address, etc. for domain data
3. **Handle errors**: Use appropriate error classes
4. **Test thoroughly**: Aim for 100% domain coverage
5. **Before committing**: Run lint, typecheck, and tests

## Important Notes

- **ESM Imports**: Always include `.js` extension
- **Node Version**: Use v22.12.0+ (check .nvmrc)
- **Legacy Format**: CSV must match Python 2.7 output exactly
- **Tax Logic**: State rates with Q4 adjustment and customer overrides
- **Validation**: Collect all errors before throwing (no fail-fast)