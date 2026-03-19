import sys
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from awsglue.job import Job
from pyspark.sql import functions as F

args = getResolvedOptions(sys.argv, ["JOB_NAME"])
sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session
job = Job(glueContext)
job.init(args["JOB_NAME"], args)

# ---- CONFIG ----
RAW_TRIPS_PATH = "s3://nyc-taxi-aws-lakehouse-bucket-dev/raw/nyc_tlc/yellow_tripdata/"
CURATED_TRIPS_PATH = "s3://nyc-taxi-aws-lakehouse-bucket-dev/curated/yellow_tripdata/"

# ---- LOAD ----
df = spark.read.parquet(RAW_TRIPS_PATH)

# ---- count original rows ----
summary = df.select(
    F.count("*").alias("row_count"),
    F.min("passenger_count").alias("min_passenger_count"),
    F.max("passenger_count").alias("max_passenger_count"),
    F.min("trip_distance").alias("min_trip_distance"),
    F.max("trip_distance").alias("max_trip_distance"),
    F.min("fare_amount").alias("min_fare_amount"),
    F.max("fare_amount").alias("max_fare_amount"),
    F.min("tip_amount").alias("min_tip_amount"),
    F.max("tip_amount").alias("max_tip_amount"),
)
summary.show(truncate=False)

# ---- Filters ----
# 1. vendors 1 and 2
df2 = df.filter(F.col("vendorid").isin([1, 2]))

# 2. timeframe Jan-Jun 2022 (pickup datetime)
pickup = F.col("tpep_pickup_datetime")
df2 = df2.filter((pickup >= F.lit("2022-01-01")) & (pickup < F.lit("2022-07-01")))

# 3. passenger_count > 0
df2 = df2.filter(F.col("passenger_count") > 0)

# 4. trip_distance >= 1 and exclude longest trip (max distance)
df2 = df2.filter(F.col("trip_distance") >= 1)
max_dist = df2.agg(F.max("trip_distance").alias("mx")).collect()[0]["mx"]
df2 = df2.filter(F.col("trip_distance") < F.lit(max_dist))

# 5. fare_amount and total_amount positive
df2 = df2.filter((F.col("fare_amount") > 0) & (F.col("total_amount") > 0))

# 6. add year/month for partitioning
df2 = df2.withColumn("year", F.year(pickup).cast("int")) \
         .withColumn("month", F.month(pickup).cast("int"))

# ---- Write curated partitioned parquet ----
(df2.write
   .mode("overwrite")
   .partitionBy("vendorid", "year", "month")
   .parquet(CURATED_TRIPS_PATH))

# --- report cleaned count (logs)
cleaned_count = df2.count()
print(f"CLEANED_ROW_COUNT={cleaned_count}")

job.commit()