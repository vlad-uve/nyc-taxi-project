export type DatasetSection = {
  title: string;
  items: string[];
};

export type DatasetInfo = {
  title: string;
  intro: string;
  sections: DatasetSection[];
  exampleQuestions: string[];
  tip: string;
};

export const datasetInfo: DatasetInfo = {
  title: "About the database",

  intro:
    "This database contains records of NYC yellow taxi trips. Each row represents one completed trip and describes when it happened, where it started and ended, how far it went, how the passenger paid, and how much was charged.",

  sections: [
    {
      title: "Trip timing:",
      items: [
        "Pickup time (tpep_pickup_datetime): The date and time when the taximeter was engaged and the trip started.",
        "Dropoff time (tpep_dropoff_datetime): The date and time when the taximeter was disengaged and the trip ended.",
        "Year (year): Partition column derived from the pickup timestamp to organize data efficiently.",
        "Month (month): Partition column derived from the pickup timestamp to help queries run faster.",
      ],
    },

    {
      title: "Trip characteristics:",
      items: [
        "Passenger count (passenger_count): Number of passengers in the vehicle. This value is entered by the driver.",
        "Trip distance (trip_distance): Distance of the trip in miles reported by the taximeter.",
        "Rate code (ratecodeid): The final rate category applied to the trip, such as standard rate, airport trips, or negotiated fares.",
        "Vendor ID (vendorid): Identifier of the technology provider that processed the trip record.",
      ],
    },

    {
      title: "Trip locations:",
      items: [
        "Pickup zone (pulocationid): TLC taxi zone where the trip started.",
        "Dropoff zone (dolocationid): TLC taxi zone where the trip ended.",
      ],
    },

    {
      title: "Payment and operations:",
      items: [
        "Payment type (payment_type): Numeric code describing how the passenger paid for the trip, such as credit card or cash.",
        "Store and forward flag (store_and_fwd_flag): Indicates whether the trip record was temporarily stored in the vehicle and uploaded later because the taxi had no connection to the server.",
      ],
    },

    {
      title: "Trip charges:",
      items: [
        "Fare amount (fare_amount): The base time-and-distance fare calculated by the taximeter.",
        "Extra charges (extra): Additional charges such as rush hour or overnight surcharges.",
        "MTA tax (mta_tax): Mandatory $0.50 tax applied to trips using metered rates.",
        "Improvement surcharge (improvement_surcharge): Surcharge applied to trips to support taxi system improvements.",
        "Congestion surcharge (congestion_surcharge): Additional charge applied to trips entering Manhattan congestion zones.",
        "Airport fee (airport_fee): Fee applied to pickups at LaGuardia or JFK airports.",
        "Tolls amount (tolls_amount): Total toll charges paid during the trip.",
        "Tip amount (tip_amount): Tip paid by the passenger (automatically recorded for credit card payments).",
        "Total amount (total_amount): Total amount charged to the passenger excluding cash tips.",
      ],
    },

    {
      title: "Partitioning:",
      items: [
        "Year (year): Partition of the table by Year of the trip (treat variable as a text, e.g., '2022').",
        "Month (month): Partition of the table by Month of the trip.",
      ],
    }
  ],

  exampleQuestions: [
    "How many trips happen by hour or weekday?",
    "Which pickup zones are the busiest?",
    "What is the average trip distance by month?",
    "How do tips vary across time or payment type?",
    "What are the average fare and total trip cost for different trip patterns?",
  ],

  tip:
    "For better performance and lower cost in Athena queries, filter by the year and month partitions and keep results small using LIMIT.",
};