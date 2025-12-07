from agno.agent import Agent
from agno.models.google import Gemini
from agno.tools.api import CustomApiTools

agent = Agent(
    model=Gemini(id="gemini-2.5-flash"),
    tools=[CustomApiTools()],
)

agent.print_response(
    'Make API calls to the following endpoints: https://ai-os-website.vercel.app/ and use all the tools. and provide all the data you get'
)