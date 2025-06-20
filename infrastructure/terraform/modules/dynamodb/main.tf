resource "aws_dynamodb_table" "invoice_table" {
  name         = var.table_name
  billing_mode = "PAY_PER_REQUEST"

  hash_key = "invoiceId"

  attribute {
    name = "invoiceId"
    type = "S"
  }

  attribute {
    name = "customerId"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  # GSI for querying invoices by customer
  global_secondary_index {
    name            = "customerId-createdAt-index"
    hash_key        = "customerId"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  # GSI for querying invoices by status
  global_secondary_index {
    name            = "status-createdAt-index"
    hash_key        = "status"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  # GSI for querying all invoices by date
  global_secondary_index {
    name            = "createdAt-index"
    hash_key        = "createdAt"
    projection_type = "ALL"
  }

  # Enable point-in-time recovery
  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }

  # Enable server-side encryption
  server_side_encryption {
    enabled = true
  }

  # TTL for invoice expiration (optional)
  dynamic "ttl" {
    for_each = var.ttl_attribute_name != "" ? [1] : []
    content {
      attribute_name = var.ttl_attribute_name
      enabled        = true
    }
  }

  # Stream configuration for event-driven processing
  stream_enabled   = var.enable_streams
  stream_view_type = var.enable_streams ? "NEW_AND_OLD_IMAGES" : null

  tags = merge(
    var.common_tags,
    {
      Name        = var.table_name
      Environment = var.environment
    }
  )
}

# Auto-scaling for provisioned capacity (if switched from on-demand)
resource "aws_appautoscaling_target" "table_read_target" {
  count              = var.billing_mode == "PROVISIONED" ? 1 : 0
  max_capacity       = var.autoscale_read_max_capacity
  min_capacity       = var.autoscale_read_min_capacity
  resource_id        = "table/${aws_dynamodb_table.invoice_table.name}"
  scalable_dimension = "dynamodb:table:ReadCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_target" "table_write_target" {
  count              = var.billing_mode == "PROVISIONED" ? 1 : 0
  max_capacity       = var.autoscale_write_max_capacity
  min_capacity       = var.autoscale_write_min_capacity
  resource_id        = "table/${aws_dynamodb_table.invoice_table.name}"
  scalable_dimension = "dynamodb:table:WriteCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_policy" "table_read_policy" {
  count              = var.billing_mode == "PROVISIONED" ? 1 : 0
  name               = "${var.table_name}-read-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.table_read_target[0].resource_id
  scalable_dimension = aws_appautoscaling_target.table_read_target[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.table_read_target[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBReadCapacityUtilization"
    }
    target_value = var.autoscale_read_target_value
  }
}

resource "aws_appautoscaling_policy" "table_write_policy" {
  count              = var.billing_mode == "PROVISIONED" ? 1 : 0
  name               = "${var.table_name}-write-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.table_write_target[0].resource_id
  scalable_dimension = aws_appautoscaling_target.table_write_target[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.table_write_target[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBWriteCapacityUtilization"
    }
    target_value = var.autoscale_write_target_value
  }
}

# Auto-scaling for GSIs (if using provisioned capacity)
resource "aws_appautoscaling_target" "gsi_read_target" {
  for_each = var.billing_mode == "PROVISIONED" ? toset([
    "customerId-createdAt-index",
    "status-createdAt-index",
    "createdAt-index"
  ]) : toset([])

  max_capacity       = var.autoscale_read_max_capacity
  min_capacity       = var.autoscale_read_min_capacity
  resource_id        = "table/${aws_dynamodb_table.invoice_table.name}/index/${each.key}"
  scalable_dimension = "dynamodb:index:ReadCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_target" "gsi_write_target" {
  for_each = var.billing_mode == "PROVISIONED" ? toset([
    "customerId-createdAt-index",
    "status-createdAt-index",
    "createdAt-index"
  ]) : toset([])

  max_capacity       = var.autoscale_write_max_capacity
  min_capacity       = var.autoscale_write_min_capacity
  resource_id        = "table/${aws_dynamodb_table.invoice_table.name}/index/${each.key}"
  scalable_dimension = "dynamodb:index:WriteCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_policy" "gsi_read_policy" {
  for_each = var.billing_mode == "PROVISIONED" ? toset([
    "customerId-createdAt-index",
    "status-createdAt-index",
    "createdAt-index"
  ]) : toset([])

  name               = "${var.table_name}-${each.key}-read-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.gsi_read_target[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.gsi_read_target[each.key].scalable_dimension
  service_namespace  = aws_appautoscaling_target.gsi_read_target[each.key].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBReadCapacityUtilization"
    }
    target_value = var.autoscale_read_target_value
  }
}

resource "aws_appautoscaling_policy" "gsi_write_policy" {
  for_each = var.billing_mode == "PROVISIONED" ? toset([
    "customerId-createdAt-index",
    "status-createdAt-index",
    "createdAt-index"
  ]) : toset([])

  name               = "${var.table_name}-${each.key}-write-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.gsi_write_target[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.gsi_write_target[each.key].scalable_dimension
  service_namespace  = aws_appautoscaling_target.gsi_write_target[each.key].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBWriteCapacityUtilization"
    }
    target_value = var.autoscale_write_target_value
  }
}