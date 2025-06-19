# AWS Configuration Guide

This guide explains how to configure AWS credentials for the invoice modernization project.

## Overview

This project uses a single AWS account with environment separation managed through:
- **Terraform workspaces** (dev, prod)
- **Resource naming conventions** (dev-* vs prod-*)
- **Tags** for resource organization

## Prerequisites

- AWS CLI v2 installed (verified: v2.27.38)
- AWS Access Key ID and Secret Access Key
- Appropriate IAM permissions for the services used

## Configuration Steps

### 1. Run the Setup Script

```bash
./scripts/setup-aws-profile.sh
```

This script will:
- Configure a single `invoice` profile
- Test the profile to ensure it's working correctly
- Explain how to use Terraform workspaces for environment management

### 2. Manual Configuration (Alternative)

If you prefer to configure manually:

```bash
# Configure the invoice profile
aws configure --profile invoice
```

You'll be prompted to enter:
- AWS Access Key ID
- AWS Secret Access Key
- Default region (e.g., us-east-1)
- Default output format (recommend: json)

### 3. Verify Configuration

Test that your profile is working:

```bash
aws sts get-caller-identity --profile invoice
```

## Profile Structure

The AWS CLI stores your configuration in:

**~/.aws/credentials:**
```ini
[invoice]
aws_access_key_id = YOUR_ACCESS_KEY
aws_secret_access_key = YOUR_SECRET_KEY
```

**~/.aws/config:**
```ini
[profile invoice]
region = us-east-1
output = json
```

## Using the Profile

### With AWS CLI Commands

```bash
# Use the invoice profile explicitly
aws s3 ls --profile invoice

# Or set it as default for your session
export AWS_PROFILE=invoice
aws s3 ls
```

### In Application Code

```typescript
// Using AWS SDK v3
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { fromIni } from "@aws-sdk/credential-provider-ini";

const client = new DynamoDBClient({
  region: "us-east-1",
  credentials: fromIni({ profile: "invoice" })
});
```

### With Terraform

```bash
# Set the profile for Terraform
export AWS_PROFILE=invoice

# Initialize Terraform
terraform init

# Create and switch to dev workspace
terraform workspace new dev
terraform workspace select dev

# Deploy to dev environment
terraform apply -var-file=environments/dev.tfvars

# Switch to prod workspace
terraform workspace select prod

# Deploy to prod environment
terraform apply -var-file=environments/prod.tfvars
```

## Environment Management Strategy

Since we're using a single AWS account, environments are separated through:

### 1. Resource Naming
All resources include the environment in their name:
```
dev-invoice-table
dev-invoice-documents-bucket
prod-invoice-table
prod-invoice-documents-bucket
```

### 2. Terraform Workspaces
Each workspace maintains separate state:
```bash
# List workspaces
terraform workspace list

# Current workspace
terraform workspace show
```

### 3. Environment Variables
The application uses environment variables to determine which resources to use:
```bash
# .env.dev
DYNAMODB_TABLE=dev-invoice-table
S3_BUCKET=dev-invoice-documents

# .env.prod
DYNAMODB_TABLE=prod-invoice-table
S3_BUCKET=prod-invoice-documents
```

## Required IAM Permissions

Your IAM user needs permissions for:

- **DynamoDB**: CreateTable, PutItem, GetItem, Query, Scan
- **S3**: CreateBucket, PutObject, GetObject, ListBucket
- **Lambda**: CreateFunction, UpdateFunctionCode, InvokeFunction
- **API Gateway**: Create/Update/Delete APIs
- **CloudWatch Logs**: CreateLogGroup, PutLogEvents
- **EventBridge**: PutEvents, CreateRule
- **IAM**: Limited role creation for Lambda execution

## Security Best Practices

1. **Never commit credentials**: The `.gitignore` includes AWS credential files
2. **Use IAM roles in production**: Lambda functions should use IAM roles, not keys
3. **Rotate credentials regularly**: Set a reminder to rotate your access keys
4. **Enable MFA**: Add MFA to your AWS account for additional security
5. **Least privilege**: Only grant the minimum permissions needed

## Local Development vs Production

### Local Development
- Use `AWS_PROFILE=invoice` environment variable
- Point to dev resources (dev-* prefix)
- Enable verbose logging

### Production Deployment
- Lambda functions use IAM roles (no profiles needed)
- Terraform manages the deployment
- Resources have prod-* prefix
- Restricted logging for performance

## Troubleshooting

### Profile not found
```bash
# Error: The config profile (invoice) could not be found
# Solution: Run the setup script
./scripts/setup-aws-profile.sh
```

### Invalid credentials
```bash
# Error: The security token included in the request is invalid
# Solution: Check your access keys are correct
aws configure --profile invoice
```

### Permission denied
```bash
# Error: User is not authorized to perform: dynamodb:CreateTable
# Solution: Ensure your IAM user has the required permissions
```

## Next Steps

1. Run the setup script to configure your AWS profile
2. Continue with the project setup in TASKS.md
3. When you reach the Terraform section, we'll set up workspaces for environment management