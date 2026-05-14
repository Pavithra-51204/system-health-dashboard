terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket = "health-dashboard-tfstate-811825121504"
    key    = "health-dashboard/terraform.tfstate"
    region = "us-east-1"
  }
}