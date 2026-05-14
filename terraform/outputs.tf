output "ec2_public_ip" {
  value       = aws_instance.app_server.public_ip
  description = "EC2 public IP — use this to access the app"
}

output "rds_endpoint" {
  value       = aws_db_instance.postgres.endpoint
  description = "RDS endpoint — use as DB_HOST in backend"
}

output "ecr_url" {
  value       = aws_ecr_repository.app.repository_url
  description = "ECR URL — use in Jenkinsfile"
}