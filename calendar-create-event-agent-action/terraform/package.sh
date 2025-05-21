#!/bin/bash
# package.sh - Prepare and zip the Lambda function for Terraform deployment.
# Usage: Run this script before `terraform apply` to create function.zip.

set -e
CODE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ZIP_FILE="function.zip"

echo "Installing npm dependencies..."
pushd "${CODE_DIR}"
npm install --production
echo "Packaging Lambda function into ${ZIP_FILE}..."
zip -r "${OLDPWD}/${ZIP_FILE}" .
popd

echo "Packaged Lambda function to ${ZIP_FILE}."