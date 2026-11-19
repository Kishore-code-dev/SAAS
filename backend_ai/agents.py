from crewai import Agent
from langchain_openai import ChatOpenAI
import os

class FleetAgents:
    def __init__(self, llm=None):
        self.llm = llm or ChatOpenAI(model_name="gpt-4o", temperature=0.2)

    def diagnostician(self):
        return Agent(
            role='Lead Fleet Diagnostician',
            goal='Analyze vehicle component health and historical maintenance to identify high-probability failure windows',
            backstory="""You are an expert automotive engineer with decades of experience in commercial fleet maintenance. 
            You specialize in identifying subtle wear patterns in ICE and EV vehicles, specifically for the Indian road context (monsoon impact, pothole stress).
            Your analysis is deep and technical, looking at component scores and historical service logs.""",
            llm=self.llm,
            verbose=True,
            allow_delegation=False
        )

    def financial_analyst(self):
        return Agent(
            role='Fleet Financial Optimizer',
            goal='Calculate the financial impact of maintenance decisions, focusing on ROI and Cost of Delay',
            backstory="""You are a data-driven financial analyst specializing in logistics and fleet operations.
            You understand the 'Cost of Delay'—how a minor ₹5,000 fix today prevents a ₹50,000 roadside breakdown tomorrow.
            You quantify risk in currency (INR) and help prioritize maintenance based on potential loss prevention.""",
            llm=self.llm,
            verbose=True,
            allow_delegation=False
        )

    def maintenance_coordinator(self):
        return Agent(
            role='Predictive Maintenance Coordinator',
            goal='Synthesize technical and financial insights into actionable, prioritized maintenance recommendations',
            backstory="""You are the master coordinator for Drive Mitra's AI engine. You take technical failure 
            probabilities and financial risk assessments to create a final, ranked list of maintenance actions.
            You ensure that recommendations are practical, clear, and high-impact.""",
            llm=self.llm,
            verbose=True,
            allow_delegation=True
        )
