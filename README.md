# 1. AI Analytics Agent — NYC Yellow Taxi Dataset

![Next.js](https://img.shields.io/badge/Next.js-111827?style=flat-square)
![OpenAI API](https://img.shields.io/badge/OpenAI_API-4F46E5?style=flat-square)
![AWS Lambda](https://img.shields.io/badge/AWS_Lambda-F59E0B?style=flat-square)
![API Gateway](https://img.shields.io/badge/API_Gateway-EC4899?style=flat-square)
![Athena](https://img.shields.io/badge/Athena-2563EB?style=flat-square)
![Glue ETL](https://img.shields.io/badge/Glue_ETL-7C3AED?style=flat-square)
![Amazon S3](https://img.shields.io/badge/Amazon_S3-16A34A?style=flat-square)
![Plotly](https://img.shields.io/badge/Plotly-334155?style=flat-square)
![AWS Amplify](https://img.shields.io/badge/AWS_Amplify-F97316?style=flat-square)

![LLM Agent](https://img.shields.io/badge/LLM_Agent-3B82F6?style=flat-square)
![Text-to-SQL](https://img.shields.io/badge/Text--to--SQL-8B5CF6?style=flat-square)
![Serverless](https://img.shields.io/badge/Serverless-F59E0B?style=flat-square)
![Data Lake](https://img.shields.io/badge/Data_Lake-16A34A?style=flat-square)
![Data Engineering](https://img.shields.io/badge/Data_Engineering-EAB308?style=flat-square)
![Cloud Analytics](https://img.shields.io/badge/Cloud_Analytics-38BDF8?style=flat-square)

## 👉 **Click to try the live demo:** [AI Analytics Agen](https://frontend-test.d5ftrm9s2ee69.amplifyapp.com/)

## 1.1. Overview
An AI-powered analytics demo that showcases how an LLM agent can translate business questions into queries over the NYC Yellow Taxi dataset stored in a cloud analytics environment. 

The model converts natural language requests into SQL or chart specifications. The backend executes them safely in AWS Athena and returns results as structured tables or interactive charts.

## 1.2. Business Value
This project shows how LLM-based analytics agents can improve self-service analytics by:
- making large datasets easier to use for non-technical users
- reducing dependence on manual SQL
- accelerating access to insights
- simplifying exploration of cloud-based analytical data

## 1.3. Problem and Solution
Analytical datasets often remain difficult to access for business users who do not know SQL, understand table schemas, or work directly with cloud query tools. 

This project addresses that problem by providing:
- a natural language interface for analytics
- automatic SQL generation
- visual outputs for faster interpretation

## 1.4. Dataset

This project uses the NYC Yellow Taxi Trip Records dataset, which contains detailed information about taxi trips across New York City, including timestamps, locations, distances, fares, and payment details.

It serves as a representative example of a large-scale business dataset that requires SQL-based querying to extract insights. 

Due to its size and complexity, it is an ideal candidate for demonstrating how an LLM agent can enable intuitive, self-service analytics.

Source: https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page

---
# 2. Technical Architecture

## 2.1 Tech Stack

### Frontend & Visualization
- **Next.js** - user interface and client-side logic  
- **Plotly** - interactive data visualizations  

### AI Layer
- **OpenAI (ChatGPT API)** - natural language understanding and text-to-SQL generation  

### Backend & API
- **AWS Lambda** - serverless backend for orchestration  
- **Amazon API Gateway** - API layer for request handling  

### Data & Analytics
- **Amazon S3** - data lake storage  
- **AWS Glue** - data catalog and ETL (Spark)  
- **Amazon Athena** - serverless SQL query engine  

### Deployment
- **AWS Amplify** - frontend hosting and CI/CD  

## 2.2. Agentic Workflow

This project uses an agentic workflow in which an LLM acts as an orchestrated analytics agent following an engineered prompt, semantic layer, and response schema to interprets the user’s request and return the appropriate query or chart specification.

The workflow follows these main stages:

### 1. Interpret the request  
   The agent receives a natural language question (NLQ) and identifies the user’s intent, such as retrieving a metric, comparing categories, filtering records, or generating a chart.

### 2. Reason over the dataset context  
   Using schema and semantic-layer context, the agent determines which fields, filters, aggregations, and groupings are relevant to answer the question correctly.

### 3. Generate SQL or visualization instructions
   Based on the inferred intent, the agent produces either a SQL query for tabular analysis or a chart specification for visual output.

### 4. Apply guardrails and validation  
   Before execution, the backend validates the generated query to enforce read-only behavior, limit unsafe patterns, and ensure the request stays within the intended analytical scope.

### 5. Execute in AWS Athena  
   Approved queries are executed against the curated NYC Yellow Taxi dataset in AWS Athena.

### 6. Return structured results  
   The system returns query results as tables and, when relevant, renders them as interactive Plotly charts.

### 7. Expose reasoning through transparent outputs  
   The generated SQL is shown to the user so the workflow remains inspectable and trustworthy rather than operating as a black box.

## 2.3. Implementation Stages

The project was built as an end-to-end AWS-based analytics workflow using serverless AWS services.

### 1. Storage & Ingestion
Raw NYC TLC data is stored in Amazon S3 as the foundation of the data lake.

- S3 buckets act as the primary storage layer  
- Raw data includes trip records (Parquet) and supporting lookup data (CSV)

### 2. Metadata & Catalog
AWS Glue is used to make the data queryable.

- Glue Crawlers scan raw data in S3 and create table definitions  
- Tables are registered in the AWS Glue Data Catalog  
- The catalog acts as a centralized, Hive-compatible metadata layer for Athena  

### 3. Data Cleaning & Normalization
Data is transformed into an analytics-ready format using AWS Glue ETL (Spark).

- Cleaning and normalization rules are applied to raw data  
- Transformations are implemented using Spark (Python)  
- Curated datasets are written back to S3  
- Output is stored in Parquet format and partitioned by year, month, and vendor for efficient querying  

### 4. SQL Analytics Layer
Amazon Athena is used as the query engine.

- Queries are executed directly on curated data in S3  
- Glue Data Catalog provides schema and table definitions  
- Enables serverless, scalable SQL analytics without managing infrastructure  

### 5. Backend Orchestration
AWS Lambda and API Gateway handle application logic.

- Receive requests from the frontend  
- Call the LLM to generate SQL or chart specifications  
- Validate queries using guardrails  
- Execute queries in Athena and return results  

### 6. Frontend Application
The user interface is built with Next.js.

- Accepts natural language questions or manual SQL  
- Displays generated SQL for transparency  
- Renders results as tables or interactive Plotly charts  

### 7. Deployment
The application is deployed using AWS Amplify.

- Hosts the frontend application  
- Provides streamlined CI/CD and deployment workflow  


---
# 3. How to Replicate

This project can be reproduced by setting up the same AWS-based analytics pipeline and connecting it to the frontend and LLM-powered backend.

Although this implementation uses the NYC Yellow Taxi dataset, the same approach can be applied to other large partitioned datasets. To adapt it to a different domain, the semantic layer, engineered prompt, response schema, and sample queries should be updated to reflect the new dataset structure, business logic, and expected outputs.

## 3.1. Prerequisites
- AWS account
- OpenAI API key
- Node.js environment
- Amazon S3 bucket for dataset storage and Athena query results
- AWS Glue Data Catalog
- AWS Glue ETL
- Amazon Athena
- AWS Lambda and API Gateway
- AWS Amplify for frontend deployment

## 3.2. Repository Structure
- `glue/` - ETL Glue job script
- `frontend/` - Next.js user interface
- `lambda/` - backend orchestration and query execution logic
- `agent/` - LLM agent assets, including the semantic layer
- `deployment/` - deployment configuration and infrastructure-related files, including Amplify setup

## 3.3. Environment Variables

To run the project, both the backend and frontend require environment-specific configuration.

#### Lambda environment variables
The backend Lambda uses environment variables such as:

- `ATHENA_DB` - Athena database name
- `ATHENA_RESULTS_S3` - S3 path for Athena query results
- `ATHENA_TABLE` - curated table queried by the application
- `ATHENA_WORKGROUP` - Athena workgroup used for execution
- `BEDROCK_MODEL_ID` - model identifier if using Bedrock-based generation
- `MAX_QUESTION_CHARS` - limit for input question length
- `OPENAI_MAX_OUTPUT_TOKENS` - output token limit for model responses
- `OPENAI_MODE` - LLM mode or provider configuration
- `OPENAI_SECRET_ID` - secret reference for the OpenAI API key
- `OPENAI_TEMPERATURE` - model temperature setting
- `SEMANTIC_LAYER_S3` - S3 path to the semantic layer file

#### Frontend environment variables
The frontend uses configuration such as:

- `API_URL` - backend API endpoint
- `API_KEY` - API key used to call the backend

For local development, these can be stored in `frontend/.env.local`.  
For deployment, they can be configured in AWS Amplify environment settings.

#### Amplify-specific settings
Amplify may also include deployment-related variables such as:

- `AMPLIFY_DIFF_DEPLOY` - controls diff-based deployments
- `AMPLIFY_MONOREPO_APP_ROOT` - identifies the frontend app root in a monorepo


## 3.4. Setup

1. Clone the repository.  

2. Upload the raw dataset to Amazon S3. This project uses the NYC Yellow Taxi ### dataset, but the workflow can also be applied to other partitioned datasets.  

3. Use AWS Glue Crawlers or manual table definitions to register the raw data in the Glue Data Catalog.  

4. Preprocess and normalize the raw data using AWS Glue ETL job script, so it becomes analytics-ready. This may include cleaning, schema normalization, type correction, enrichment, and writing curated output back to S3 in partitioned Parquet format. 

5. Register the curated dataset in AWS Glue and make it queryable in Athena.  

6. Update the semantic layer, prompt design, response schema, and sample queries so the LLM agent aligns with the structure and meaning of the chosen dataset.  

7. Configure the backend with the required AWS resource names, Athena settings, semantic layer file location, and OpenAI API credentials.  

8. Deploy the Lambda function and expose it through API Gateway.  

9. Run the Next.js frontend locally or deploy it with AWS Amplify.  

10. Connect the frontend to the backend API and test both natural language and SQL-based queries.

## 3.5. Result
Once configured, the application can accept natural language questions, generate SQL or chart instructions, query the curated dataset in Athena, and return tabular or visual results through the frontend.