# Infrastructure Guide

This guide covers infrastructure deployment and management using Terraform and AWS services.

## Terraform Setup

### Prerequisites

- Terraform 1.12.2 or higher
- AWS CLI configured with appropriate credentials
- Access to target AWS account

### Workspace Management

```bash
# Navigate to infrastructure directory
cd infrastructure/terraform

# Initialize Terraform
terraform init

# List workspaces
terraform workspace list

# Create new workspace
terraform workspace new dev
terraform workspace new staging
terraform workspace new prod

# Switch workspace
terraform workspace select dev
```

## Deployment Commands

### Planning Changes

```bash
# Plan with specific environment
terraform plan -var-file=environments/dev.tfvars

# Plan with output to file
terraform plan -var-file=environments/dev.tfvars -out=tfplan

# Show planned changes
terraform show tfplan
```

### Applying Changes

```bash
# Apply with environment file
terraform apply -var-file=environments/dev.tfvars

# Apply saved plan
terraform apply tfplan

# Auto-approve (use with caution)
terraform apply -var-file=environments/dev.tfvars -auto-approve
```

### State Management

```bash
# List resources in state
terraform state list

# Show specific resource
terraform state show aws_lambda_function.invoice_processor

# Import existing resource
terraform import aws_s3_bucket.invoices invoice-bucket-prod

# Remove resource from state (without destroying)
terraform state rm aws_lambda_function.old_processor
```

## AWS Resources

### Lambda Functions

- **InvoiceProcessor**: Processes CSV files from S3
- **InvoiceAPI**: HTTP API endpoints via API Gateway
- **PDFGenerator**: Creates invoice PDFs
- **EventProcessor**: Handles EventBridge events

### DynamoDB Tables

- **invoices**: Main invoice storage
  - Partition Key: `invoiceId`
  - Sort Key: `version`
  - GSI: `customerId-createdAt-index`
  
### S3 Buckets

- **invoice-uploads**: CSV file uploads
- **invoice-documents**: Generated PDFs
- **invoice-archives**: Long-term storage

### EventBridge

- **invoice-events**: Main event bus
- Rules:
  - `invoice-created`: Triggers PDF generation
  - `invoice-processed`: Notifies downstream systems

## Environment Configuration

### Development (dev.tfvars)

```hcl
environment = "dev"
region = "us-east-1"

lambda_settings = {
  memory_size = 512
  timeout = 30
  reserved_concurrent_executions = 5
}

dynamodb_settings = {
  read_capacity = 5
  write_capacity = 5
  point_in_time_recovery = false
}
```

### Production (prod.tfvars)

```hcl
environment = "prod"
region = "us-east-1"

lambda_settings = {
  memory_size = 1024
  timeout = 60
  reserved_concurrent_executions = 100
}

dynamodb_settings = {
  read_capacity = 25
  write_capacity = 25
  point_in_time_recovery = true
}
```

## Monitoring and Observability

### CloudWatch Dashboards

```bash
# Create dashboard from template
aws cloudwatch put-dashboard \
  --dashboard-name InvoiceProcessing \
  --dashboard-body file://dashboards/invoice-processing.json
```

### Alarms

Key metrics monitored:
- Lambda errors > 1% of invocations
- Lambda duration > 80% of timeout
- DynamoDB throttled requests > 0
- S3 4xx errors > 10 per minute

### X-Ray Tracing

```bash
# Enable X-Ray for Lambda
aws lambda update-function-configuration \
  --function-name InvoiceProcessor \
  --tracing-config Mode=Active
```

## Security Configuration

### IAM Roles

- **InvoiceProcessorRole**: Read S3, Write DynamoDB, Publish EventBridge
- **InvoiceAPIRole**: Read/Write DynamoDB, Invoke Lambda
- **PDFGeneratorRole**: Read DynamoDB, Write S3

### Secrets Management

```bash
# Store API keys
aws secretsmanager create-secret \
  --name invoice-api-keys \
  --secret-string file://secrets.json

# Rotate secrets
aws secretsmanager rotate-secret \
  --secret-id invoice-api-keys
```

### Encryption

- S3: SSE-S3 enabled by default
- DynamoDB: Encryption at rest with AWS managed keys
- Lambda environment variables: KMS encrypted

## Deployment Pipeline

### GitHub Actions Integration

```yaml
- name: Deploy to AWS
  env:
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
  run: |
    cd infrastructure/terraform
    terraform init
    terraform workspace select ${{ github.event.inputs.environment }}
    terraform apply -var-file=environments/${{ github.event.inputs.environment }}.tfvars -auto-approve
```

### Rollback Procedures

```bash
# View previous versions
terraform state list

# Revert to previous version
git checkout HEAD~1 infrastructure/
terraform apply -var-file=environments/prod.tfvars

# Emergency Lambda rollback
aws lambda update-function-code \
  --function-name InvoiceProcessor \
  --s3-bucket lambda-artifacts \
  --s3-key previous-version.zip
```

## Cost Management

### Resource Tagging

All resources tagged with:
- `Environment`: dev/staging/prod
- `Project`: invoice-modernization
- `CostCenter`: engineering
- `ManagedBy`: terraform

### Cost Optimization

```bash
# Review Lambda costs
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics UnblendedCost \
  --filter file://lambda-filter.json

# Enable S3 lifecycle policies
aws s3api put-bucket-lifecycle-configuration \
  --bucket invoice-archives \
  --lifecycle-configuration file://lifecycle.json
```

## Disaster Recovery

### Backup Strategy

- DynamoDB: Point-in-time recovery enabled
- S3: Cross-region replication for critical buckets
- Lambda: Code stored in versioned S3 bucket

### Recovery Procedures

```bash
# Restore DynamoDB table
aws dynamodb restore-table-to-point-in-time \
  --source-table-name invoices \
  --target-table-name invoices-restored \
  --restore-date-time 2024-01-01T00:00:00Z

# Restore S3 objects
aws s3 sync s3://invoice-backup s3://invoice-documents --delete
```