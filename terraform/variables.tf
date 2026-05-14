variable "aws_region" {
  default = "us-east-1"
}

variable "db_username" {
  default = "postgres"
}

variable "db_password" {
  sensitive = true
}

variable "key_pair_name" {
  default = "health-dashboard-key"
}