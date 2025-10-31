from typing import Optional
from phi.tools import Toolkit
from phi.utils.log import logger
import os
from agno.media import Image
from agno.models.google import Gemini
from agno.agent import Agent as AgnoAgent

class ImageAnalysisTools(Toolkit):
    def __init__(self):
        super().__init__(name="image_analysis_tools")
        # Register the analysis function
        self.register(self.analyze_image)
        
        # Initialize the Gemini agent for image analysis
        self.image_agent = AgnoAgent(
            model=Gemini(id="gemini-2.0-flash"),
            instructions=[
                "provide detailed description of the image",
                "You are an Image agent your job is to fulfill the user request related to the image in any way possible",
            ],
            markdown=True,
            debug_mode=False,  # Set to True for debugging
        )

    def analyze_image(self, image_path: str, query: Optional[str] = "Describe what you see in this image in detail. Include coordinates of all UI elements.") -> str:
        """Analyzes an image using the Gemini model and returns a detailed description.
        
        Args:
            image_path (str): The path to the image file to analyze.
            query (str, optional): The specific query about the image. Defaults to a general description request.
            
        Returns:
            str: Detailed description of the image including UI element coordinates.
        """
        try:
            logger.info(f"Analyzing image at path: {image_path}")
            
            # Verify file exists
            if not os.path.exists(image_path):
                return f"Error: Image file not found at {image_path}"
            
            # Process the image with the Gemini model
            response = self.image_agent.run(
                message=query,
                images=[Image(filepath=image_path)],
                stream=False
            )
            
            # Return the analysis result
            return response.content
            
        except Exception as e:
            logger.warning(f"Failed to analyze image: {e}")
            return f"Error analyzing image: {e}"