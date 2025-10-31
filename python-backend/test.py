# improved_test.py
from phi.agent import Agent
from phi.model.google import Gemini
from automation_tools import AutomationTools
from image_analysis_toolkit import ImageAnalysisTools
import os

def main():
    # Create the agent with both automation and image analysis tools
    agent = Agent(
        model=Gemini(id="gemini-2.0-flash"),
        tools=[AutomationTools(), ImageAnalysisTools()],
        markdown=True,
        show_tool_calls=True,
        instructions=[
            "You are a helpful assistant that can control a computer and analyze what's on screen.",
            "When asked about screen contents or to perform actions, follow these steps:",
            "1. First, use the 'screenshot_and_analyze' tool to capture the current screen.",
            "2. Then, use the 'analyze_image' tool with the screenshot path to get detailed information.",
            "3. Based on the analysis, perform any necessary actions using the automation tools.",
            "4. Provide a clear explanation of what you did and what you found on screen.",
            "Always provide a step-by-step explanation of your actions."
        ],
        debug_mode=True,
    )

    while True:
        user_input = input("Enter your request (or type 'exit' to quit): ")
        if user_input.lower() == 'exit':
            break

        # Run the agent with the user's input
        response = agent.print_response(message=user_input, stream=True)

if __name__ == "__main__":
    main()