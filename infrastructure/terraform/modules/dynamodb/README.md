# DynamoDB Module

This Terraform module creates a DynamoDB table for storing invoices with appropriate indexes, auto-scaling policies, and backup configuration.

## Features

- **Primary Key**: `invoiceId` (partition key)
- **Global Secondary Indexes (GSIs)**:
  - `customerId-createdAt-index`: Query invoices by customer ID, sorted by creation date
  - `status-createdAt-index`: Query invoices by status, sorted by creation date
  - `createdAt-index`: Query all invoices by creation date
- **Point-in-Time Recovery**: Enabled by default for disaster recovery
- **Auto-scaling**: Configured for provisioned capacity mode
- **Encryption**: Server-side encryption enabled
- **Streams**: DynamoDB Streams enabled for event-driven processing

## Usage

```hcl
module "invoice_dynamodb" {
  source = "./modules/dynamodb"

  table_name                    = "invoice-${var.environment}"
  environment                   = var.environment
  billing_mode                  = "PAY_PER_REQUEST"
  enable_point_in_time_recovery = true
  enable_streams                = true

  common_tags = {
    Project = "invoice-modernization"
    ManagedBy = "terraform"
  }
}
```

## Billing Modes

### Pay-Per-Request (Default)
- No capacity planning required
- Automatically scales to handle any load
- Ideal for unpredictable workloads
- No auto-scaling configuration needed

### Provisioned Capacity
- Set `billing_mode = "PROVISIONED"`
- Configure auto-scaling parameters
- More cost-effective for predictable workloads
- Auto-scaling policies automatically adjust capacity

## Auto-scaling Configuration

When using provisioned capacity mode, auto-scaling is automatically configured for:
- Table read/write capacity
- All GSI read/write capacity

Default auto-scaling settings:
- Min capacity: 5 units
- Max capacity: 100 units
- Target utilization: 70%

## Backup and Recovery

- **Point-in-Time Recovery**: Enabled by default, allows restoration to any point within the last 35 days
- **On-Demand Backups**: Can be created manually via AWS Console or CLI

## Monitoring

Key metrics to monitor:
- `ConsumedReadCapacityUnits` / `ConsumedWriteCapacityUnits`
- `UserErrors` (validation failures)
- `SystemErrors` (service issues)
- `ThrottledRequests` (capacity exceeded)

## Cost Optimization

1. Use Pay-Per-Request for variable workloads
2. Use Provisioned with auto-scaling for predictable workloads
3. Enable TTL to automatically delete old items
4. Monitor unused GSIs and remove if not needed