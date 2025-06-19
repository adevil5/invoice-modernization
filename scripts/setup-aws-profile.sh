#!/bin/bash

# Script to setup AWS profile for invoice modernization project

echo "=== AWS Profile Configuration for Invoice Modernization ==="
echo ""
echo "This script will configure a single AWS profile for the invoice project."
echo "You'll use Terraform workspaces to manage different environments (dev/prod)."
echo ""
echo "You'll need:"
echo "  - AWS Access Key ID"
echo "  - AWS Secret Access Key"
echo "  - Default region (e.g., us-east-1)"
echo ""

PROFILE_NAME="invoice"

# Check if profile already exists
if aws configure list --profile "$PROFILE_NAME" >/dev/null 2>&1; then
    echo "Profile '$PROFILE_NAME' already exists."
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Using existing profile configuration."
    else
        # Configure the profile
        aws configure --profile "$PROFILE_NAME"
    fi
else
    # Configure the profile
    echo "Configuring AWS profile: $PROFILE_NAME"
    echo "--------------------------------------"
    aws configure --profile "$PROFILE_NAME"
fi

echo ""
echo "Testing AWS access..."
echo "--------------------"
if aws sts get-caller-identity --profile "$PROFILE_NAME" >/dev/null 2>&1; then
    echo "✓ AWS profile is working correctly!"
    echo ""
    aws sts get-caller-identity --profile "$PROFILE_NAME" --output table
else
    echo "✗ Failed to authenticate with AWS."
    echo "  Please check your credentials and try again."
    exit 1
fi

echo ""
echo "=== Configuration Complete ==="
echo ""
echo "Profile '$PROFILE_NAME' is ready to use!"
echo ""
echo "Usage examples:"
echo "  aws s3 ls --profile invoice"
echo "  export AWS_PROFILE=invoice"
echo ""
echo "Environment Management:"
echo "  Development: terraform workspace select dev"
echo "  Production:  terraform workspace select prod"
echo ""
echo "Resources will be named with environment prefixes:"
echo "  dev-invoice-table  (in dev workspace)"
echo "  prod-invoice-table (in prod workspace)"
echo ""