pipeline {
    agent any

    environment {
        AWS_REGION = 'us-east-1'
        ECR_REPO   = '811825121504.dkr.ecr.us-east-1.amazonaws.com/system-health-dashboard'
        EC2_HOST   = '54.161.207.110'
        IMAGE_TAG  = "${env.BUILD_NUMBER}"
        DB_HOST    = 'health-dashboard-db.c496qquuyrh9.us-east-1.rds.amazonaws.com'
        DB_USER    = 'postgres'
        DB_NAME    = 'healthdb'
    }

    triggers {
        githubPush()
    }

    stages {

        stage('Build & Test') {
            steps {
                dir('app/backend') {
                    sh 'npm ci'
                    sh 'npm test -- --coverage --watchAll=false'
                }
                publishHTML(target: [
                    allowMissing         : false,
                    alwaysLinkToLastBuild: true,
                    keepAll              : true,
                    reportDir            : 'app/backend/coverage/lcov-report',
                    reportFiles          : 'index.html',
                    reportName           : 'Coverage Report'
                ])
            }
        }

        stage('Docker Build') {
            steps {
                sh '''
                    aws ecr get-login-password --region $AWS_REGION | \
                    docker login --username AWS --password-stdin $ECR_REPO

                    docker build -t $ECR_REPO:$IMAGE_TAG ./app/backend

                    docker build \
                      --build-arg VITE_API_URL=http://$EC2_HOST \
                      -t $ECR_REPO:frontend-$IMAGE_TAG \
                      -f app/frontend/Dockerfile .
                '''
            }
        }

        stage('Push to ECR') {
            steps {
                sh '''
                    docker push $ECR_REPO:$IMAGE_TAG
                    docker push $ECR_REPO:frontend-$IMAGE_TAG
                    echo "BACKEND_IMAGE=$ECR_REPO:$IMAGE_TAG" > deploy.env
                    echo "FRONTEND_IMAGE=$ECR_REPO:frontend-$IMAGE_TAG" >> deploy.env
                    echo "BUILD_NUMBER=$IMAGE_TAG" >> deploy.env
                '''
                archiveArtifacts artifacts: 'deploy.env'
            }
        }

        stage('Deploy') {
            steps {
                withCredentials([string(credentialsId: 'db-password', variable: 'DB_PASSWORD')]) {
                    sh '''
                        aws ecr get-login-password --region $AWS_REGION | \
                        docker login --username AWS --password-stdin $ECR_REPO

                        docker pull $ECR_REPO:$IMAGE_TAG
                        docker pull $ECR_REPO:frontend-$IMAGE_TAG

                        docker stop backend frontend || true
                        docker rm backend frontend || true

                        docker run -d --name backend \
                          -e DB_HOST=$DB_HOST \
                          -e DB_PORT=5432 \
                          -e DB_NAME=$DB_NAME \
                          -e DB_USER=$DB_USER \
                          -e DB_PASSWORD=$DB_PASSWORD \
                          -e PORT=3000 \
                          --restart unless-stopped \
                          $ECR_REPO:$IMAGE_TAG

                        docker run -d --name frontend \
                          --link backend:backend \
                          -p 80:80 \
                          --restart unless-stopped \
                          $ECR_REPO:frontend-$IMAGE_TAG
                    '''
                }
            }
        }
    }

    post {
        success {
            sh 'sleep 15 && curl -f http://$EC2_HOST/health || exit 1'
            echo 'Deployment successful'
        }
        failure {
            echo 'Pipeline failed — check console output'
        }
    }
}