from crewai import Task
from textwrap import dedent

class FleetTasks:
    def failure_prediction_task(self, agent, vehicle_data):
        return Task(
            description=dedent(f"""
                Analyze the following vehicle data for potential failures:
                {vehicle_data}
                
                Focus on:
                1. Identifying which components (engine, brakes, etc.) are trending towards failure.
                2. Estimating the 'Predicted Failure Date' based on current wear rates and regional stress factors.
                3. Calculating a confidence score (0-1) for each prediction.
                
                Consider Indian road conditions (Madurai high heat, Chennai humidity) in your assessment.
            """),
            agent=agent,
            expected_output="A technical report detailing component risks, failure windows, and causal factors."
        )

    def financial_risk_task(self, agent, diagnostics_report):
        return Task(
            description=dedent(f"""
                Based on the following diagnostics report:
                {diagnostics_report}
                
                Calculate:
                1. Estimated cost if fixed now (preventive).
                2. Estimated cost if fixed after failure (reactive/roadside).
                3. Cost of delay per day.
                4. Final ROI (Savings) if fixed within the next 7 days.
                
                Output all values in INR.
            """),
            agent=agent,
            expected_output="A financial impact assessment with clear cost-benefit analysis for each predicted failure."
        )

    def actionable_recommendation_task(self, agent, context):
        return Task(
            description=dedent(f"""
                Review the technical diagnostics and financial analysis. 
                Generate a final set of AI predictions for ingestion into the database.
                
                The output MUST be a structured summary for each vehicle, including:
                - Component Name
                - Priority (low, medium, high, critical)
                - AI Reasoning (a concise explanation)
                - Specific Recommendation
                - 30-day failure probability
            """),
            agent=agent,
            context=context,
            expected_output="A final list of prioritized maintenance recommendations with clear justifications."
        )
