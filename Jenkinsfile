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
                // Write deploy log script to file and execute
                sh '''
                    cat > /tmp/log-deploy.js << 'JSEOF'
                    const { Pool } = require('pg');
                    const pool = new Pool({
                    host: process.env.DB_HOST,
                    port: 5432,
                    database: process.env.DB_NAME,
                    user: process.env.DB_USER,
                    password: process.env.DB_PASSWORD,
                    ssl: { rejectUnauthorized: false }
                    });
                    const version = process.env.BUILD_VERSION;
                    pool.query(
                    'INSERT INTO deployments (version, status) VALUES ($1, $2)',
                    [version, 'success']
                    ).then(() => {
                    console.log('Deployment logged:', version);
                    process.exit(0);
                    }).catch(err => {
                    console.log('Log error:', err.message);
                    process.exit(0);
                    });
                JSEOF
                    docker cp /tmp/log-deploy.js backend:/tmp/log-deploy.js
                    docker exec -e BUILD_VERSION=v1.0-build-$IMAGE_TAG backend node /tmp/log-deploy.js
                '''
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