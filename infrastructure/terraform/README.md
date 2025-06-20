# Invoice Modernization - Terraform Infrastructure

This directory contains the Terraform configuration for the Invoice Modernization project's AWS infrastructure.

## Prerequisites

- Terraform >= 1.12.0
- AWS CLI configured with appropriate credentials
- AWS profile named `invoice` (or update in tfvars)

## Quick Start

### 1. Setup Backend Configuration

First, create an S3 bucket and DynamoDB table for Terraform state management:

```bash
# Create S3 bucket for state (replace with your unique bucket name)
aws s3api create-bucket \
  --bucket your-terraform-state-bucket \
  --region us-east-1 \
  --profile invoice

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket your-terraform-state-bucket \
  --versioning-configuration Status=Enabled \
  --profile invoice

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name terraform-state-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --provisioned-throughput ReadCapacityUnits=1,WriteCapacityUnits=1 \
  --region us-east-1 \
  --profile invoice
```

### 2. Configure Backend

Copy the example backend configuration and update with your values:

```bash
cp backend-dev.hcl.example backend-dev.hcl
# Edit backend-dev.hcl with your bucket name
```

### 3. Initialize Terraform

```bash
terraform init -backend-config=backend-dev.hcl
```

### 4. Create and Select Workspace

Workspaces are used to manage multiple environments:

```bash
# Create dev workspace
terraform workspace new dev

# List workspaces
terraform workspace list

# Select workspace
terraform workspace select dev
```

### 5. Configure Environment Variables

Copy the example tfvars file for your environment:

```bash
cp environments/dev.tfvars.example environments/dev.tfvars
# Edit environments/dev.tfvars as needed
```

### 6. Plan and Apply

```bash
# Plan changes
terraform plan -var-file=environments/dev.tfvars

# Apply changes
terraform apply -var-file=environments/dev.tfvars
```

## Project Structure

```
.
├── main.tf                    # Main Terraform configuration
├── variables.tf               # Input variable definitions
├── outputs.tf                 # Output value definitions
├── backend-dev.hcl.example    # Example backend configuration
├── environments/              # Environment-specific configurations
│   ├── dev.tfvars.example
│   └── prod.tfvars.example
└── modules/                   # Terraform modules (to be created)
    ├── dynamodb/
    ├── lambda/
    └── api-gateway/
```

## Workspace Management

This project uses Terraform workspaces to manage multiple environments:

- `dev` - Development environment (cost-optimized for testing)
- `prod` - Production environment (performance-optimized)

Each workspace maintains its own state file and can have different configurations.

### Why Only Dev and Prod?

For this demonstration project, we've intentionally chosen a two-environment AWS setup:
1. **Cost efficiency**: Minimizes AWS costs while demonstrating environment separation
2. **Sufficient complexity**: Shows environment promotion and configuration management
3. **Pragmatic approach**: In real production systems, a staging environment would be added for final QA testing

Local development uses the local Terraform backend and doesn't require AWS resources.

## Common Commands

```bash
# Initialize with backend
terraform init -backend-config=backend-${ENV}.hcl

# Create new workspace
terraform workspace new ${ENV}

# Switch workspace
terraform workspace select ${ENV}

# Plan with environment variables
terraform plan -var-file=environments/${ENV}.tfvars

# Apply with auto-approve (use carefully!)
terraform apply -var-file=environments/${ENV}.tfvars -auto-approve

# Destroy resources (use very carefully!)
terraform destroy -var-file=environments/${ENV}.tfvars

# Format Terraform files
terraform fmt -recursive

# Validate configuration
terraform validate
```

## Environment-Specific Settings

The configuration automatically adjusts based on the workspace:

| Setting | Dev | Prod |
|---------|-----|------|
| Lambda Memory | 512 MB | 1024 MB |
| Lambda Timeout | 30s | 60s |
| DynamoDB Billing | On-Demand | Provisioned |
| Log Retention | 7 days | 365 days |
| API Caching | Disabled | Enabled |

## Security Considerations

1. **State Files**: Contains sensitive information. Always use encrypted S3 backend.
2. **Backend Config**: Never commit `backend-*.hcl` files (use `.hcl.example` files).
3. **Variables**: Never commit `*.tfvars` files with sensitive data.
4. **IAM Roles**: Follow least privilege principle.
5. **Encryption**: All S3 buckets use AES256 encryption by default.

## Troubleshooting

### State Lock Issues

If Terraform is stuck with a state lock:

```bash
# Force unlock (use carefully!)
terraform force-unlock <LOCK_ID>
```

### Workspace Issues

If you're in the wrong workspace:

```bash
# Check current workspace
terraform workspace show

# Switch to correct workspace
terraform workspace select <WORKSPACE>
```

### Backend Re-initialization

If you need to change backend configuration:

```bash
# Remove local state
rm -rf .terraform/

# Re-initialize
terraform init -backend-config=backend-<ENV>.hcl -reconfigure
```

## Next Steps

After basic infrastructure is set up, the following modules will be created:

1. **DynamoDB Module** - Invoice storage with GSI for queries
2. **Lambda Module** - Function definitions with layers
3. **API Gateway Module** - REST API configuration
4. **EventBridge Module** - Event routing rules
5. **Monitoring Module** - CloudWatch dashboards and alarms