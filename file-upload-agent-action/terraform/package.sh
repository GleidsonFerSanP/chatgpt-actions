#!/bin/bash
# package.sh - Prepare and zip the Lambda function for Terraform deployment.
# Usage: Run this script before `terraform apply` to create lambda_function.zip.

set -e
CODE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ZIP_FILE="lambda_function.zip"

echo "Installing npm dependencies..."
pushd "${CODE_DIR}"
npm install --production
echo "Packaging Lambda function into ${ZIP_FILE}..."
zip -r "${OLDPWD}/${ZIP_FILE}" . -x "terraform/*" ".terraform/*" "*.tf*" "package.sh" "lambda_function.zip"
popd

echo "Packaged Lambda function to ${ZIP_FILE}."