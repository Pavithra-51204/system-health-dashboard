pipeline {
    agent any

    environment {
        AWS_REGION = 'us-east-1'
        ECR_REPO   = '811825121504.dkr.ecr.us-east-1.amazonaws.com/system-health-dashboard'
        EC2_HOST   = 'system-health.duckdns.org'
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
                sh '''
                    docker run --rm \
                      -v $(pwd)/app/backend:/app \
                      -w /app \
                      node:20-alpine \
                      sh -c "npm ci && npm test -- --coverage --watchAll=false"
                '''
                publishHTML(target: [
                    allowMissing         : true,
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

                    cp nginx/nginx.conf app/frontend/nginx.conf
                    docker build \
                      --no-cache \
                      --build-arg VITE_API_URL=https://$EC2_HOST \
                      -t $ECR_REPO:frontend-$IMAGE_TAG \
                      app/frontend
                    rm app/frontend/nginx.conf
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
                          -p 443:443 \
                          -v /etc/letsencrypt:/etc/letsencrypt:ro \
                          --restart unless-stopped \
                          $ECR_REPO:frontend-$IMAGE_TAG

                        sleep 10
                    '''

                    sh """
                        docker exec backend node -e "
                        var pg = require('pg');
                        var pool = new pg.Pool({
                            host: '${DB_HOST}',
                            port: 5432,
                            database: '${DB_NAME}',
                            user: '${DB_USER}',
                            password: '\${DB_PASSWORD}',
                            ssl: {rejectUnauthorized: false}
                        });
                        pool.query('INSERT INTO deployments (version, status) VALUES (\\\$1, \\\$2)', ['v1.0-build-${IMAGE_TAG}', 'success'])
                            .then(function(){ console.log('Deployment logged'); process.exit(0); })
                            .catch(function(e){ console.log('Log error:', e.message); process.exit(0); });
                        "
                    """
                }
            }
        }
    }

    post {
        success {
            sh 'sleep 15 && curl -f https://$EC2_HOST/health || exit 1'
            echo 'Deployment successful'
        }
        failure {
            echo 'Pipeline failed — check console output'
        }
    }
}