#python-backend/web_analyzer.py
from typing import Optional, Dict, Any, List, Union
import time
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
import pytesseract
from PIL import Image
import os
from datetime import datetime

from phi.tools import Toolkit
from phi.utils.log import logger


class WebAnalyzerTools(Toolkit):
    def __init__(self):
        super().__init__(name="web_analyzer_tools")
        # Register the main analysis function
        self.register(self.analyze_webpage)
        self.register(self.summarize_html)
        self.register(self.extract_interactive_elements)
        self.register(self.perform_ocr_on_image)

    def analyze_webpage(self, url: str, wait_time: int = 5, save_screenshot: bool = True,
                       headless: bool = False, extract_elements: bool = True,
                       perform_ocr: bool = True) -> str:
        """
        Performs a comprehensive analysis of a webpage, including HTML structure,
        interactive elements, and OCR text extraction.
        
        Args:
            url (str): The URL of the webpage to analyze
            wait_time (int): Time in seconds to wait for dynamic content to load
            save_screenshot (bool): Whether to save a screenshot of the page
            headless (bool): Whether to run the browser in headless mode
            extract_elements (bool): Whether to extract interactive elements
            perform_ocr (bool): Whether to perform OCR on the screenshot
            
        Returns:
            str: Detailed analysis of the webpage
        """
        try:
            logger.info(f"Starting analysis of {url}")
            
            with sync_playwright() as p:
                # Launch browser
                browser = p.chromium.launch(headless=headless)
                context = browser.new_context()
                page = context.new_page()
                
                # Navigate to URL
                logger.info(f"Navigating to {url}")
                page.goto(url)
                logger.info(f"Waiting {wait_time} seconds for dynamic content...")
                time.sleep(wait_time)
                
                # Get HTML content for analysis
                html_content = page.content()
                html_summary = self.summarize_html(html_content)
                
                # Initialize results
                screenshot_path = None
                interactive_summary = "Interactive Elements: None extracted"
                ocr_text = "OCR Analysis: Not performed"
                
                # Take screenshot if requested
                if save_screenshot:
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    screenshot_path = f"webpage_screenshot_{timestamp}.png"
                    page.screenshot(path=screenshot_path, full_page=True)
                    logger.info(f"Screenshot saved to {screenshot_path}")
                
                # Extract interactive elements if requested
                if extract_elements:
                    interactive_elements = self.extract_interactive_elements(page)
                    interactive_summary = "Interactive Elements:\n"
                    if interactive_elements:
                        for elem in interactive_elements:
                            if "error" in elem:
                                interactive_summary += f"Element {elem.get('index')}: Error - {elem.get('error')}\n"
                            else:
                                interactive_summary += (
                                    f"Element {elem.get('index')}:\n"
                                    f"  Tag: {elem.get('tag')}\n"
                                    f"  Text: {elem.get('text')}\n"
                                )
                                if elem.get("tag") == "INPUT":
                                    interactive_summary += f"  Input Type: {elem.get('input_type')}\n"
                                interactive_summary += (
                                    f"  Bounding Box: {elem.get('bounding_box')}\n"
                                    f"  Selector: {elem.get('css_selector')}\n\n"
                                )
                    else:
                        interactive_summary += "No interactive elements found.\n"
                
                # Perform OCR if requested and screenshot was taken
                if perform_ocr and screenshot_path:
                    try:
                        ocr_text = self.perform_ocr_on_image(screenshot_path)
                    except Exception as e:
                        ocr_text = f"Error during OCR: {e}"
                
                # Close browser
                browser.close()
                
                # Combine all information into detailed description
                detailed_description = (
                    f"Detailed Analysis of {url}:\n\n"
                    f"HTML Analysis Summary:\n{html_summary}\n\n"
                    f"{interactive_summary}\n"
                    f"Visual (OCR) Analysis Summary:\n{ocr_text}\n"
                )
                
                return detailed_description
                
        except Exception as e:
            logger.error(f"Error analyzing webpage: {e}")
            return f"Failed to analyze webpage: {e}"

    def summarize_html(self, html: str) -> str:
        """
        Parses HTML content and produces a plain English summary.
        Extracts title, meta description, headings, paragraphs, and links.
        
        Args:
            html (str): HTML content to analyze
            
        Returns:
            str: Summarized HTML content
        """
        try:
            soup = BeautifulSoup(html, 'html.parser')
            
            # Extract page title
            title = soup.title.string.strip() if soup.title and soup.title.string else "No title found"
            
            # Extract meta description
            meta = soup.find("meta", attrs={"name": "description"})
            meta_desc = meta.get("content").strip() if meta and meta.get("content") else "No meta description found"
            
            # Extract headings (h1, h2, h3)
            headings = []
            for tag in ['h1', 'h2', 'h3']:
                for h in soup.find_all(tag):
                    text = h.get_text(strip=True)
                    if text:
                        headings.append(f"{tag.upper()}: {text}")
            
            # Extract sample paragraphs (limit to first 5)
            paragraphs = []
            for p in soup.find_all('p'):
                text = p.get_text(strip=True)
                if text:
                    paragraphs.append(text)
                    if len(paragraphs) >= 5:
                        break
            
            # Extract sample links (limit to first 5)
            links = []
            for a in soup.find_all('a'):
                text = a.get_text(strip=True)
                href = a.get("href", "").strip()
                if text:
                    links.append(f"Link Text: '{text}' -> URL: {href}")
                    if len(links) >= 5:
                        break
            
            summary = (
                f"Title: {title}\n"
                f"Meta Description: {meta_desc}\n\n"
                "Headings:\n" + ("\n".join(headings) if headings else "None found") + "\n\n"
                "Sample Paragraphs:\n" + ("\n".join(paragraphs) if paragraphs else "None found") + "\n\n"
                "Sample Links:\n" + ("\n".join(links) if links else "None found")
            )
            
            return summary
            
        except Exception as e:
            logger.error(f"Error summarizing HTML: {e}")
            return f"Failed to summarize HTML: {e}"

    def extract_interactive_elements(self, page) -> List[Dict[str, Any]]:
        """
        Extracts details of interactive elements on a webpage.
        
        Args:
            page: Playwright page object of the loaded webpage
            
        Returns:
            List[Dict[str, Any]]: List of interactive elements with details
        """
        try:
            interactive_elements = []
            # Query for common interactive elements
            selectors = "button, input, a, select, textarea"
            elements = page.query_selector_all(selectors)
            
            for idx, element in enumerate(elements, start=1):
                try:
                    # Get the tag name
                    tag = element.evaluate("node => node.tagName")
                    # Get visible text (or a placeholder if none)
                    text = element.inner_text().strip() if element.inner_text() else "No visible text"
                    bbox = element.bounding_box() or {}
                    # For input fields, capture the type attribute
                    input_type = ""
                    if tag == "INPUT":
                        input_type = element.get_attribute("type") or "text"
                    
                    # Generate a unique CSS selector via a JS snippet
                    css_selector = page.evaluate(
                        """(el) => {
                            function getCssPath(element) {
                                if (!(element instanceof Element))
                                    return '';
                                const path = [];
                                while (element.nodeType === Node.ELEMENT_NODE) {
                                    let selector = element.nodeName.toLowerCase();
                                    if (element.id) {
                                        selector += '#' + element.id;
                                        path.unshift(selector);
                                        break;
                                    } else {
                                        let sib = element, nth = 1;
                                        while(sib = sib.previousElementSibling) {
                                            if(sib.nodeName.toLowerCase() === selector)
                                                nth++;
                                        }
                                        selector += `:nth-of-type(${nth})`;
                                    }
                                    path.unshift(selector);
                                    element = element.parentNode;
                                }
                                return path.join(" > ");
                            }
                            return getCssPath(el);
                        }""", element
                    )
                    
                    # Build the element's summary
                    elem_summary = {
                        "index": idx,
                        "tag": tag,
                        "text": text,
                        "bounding_box": bbox,
                        "css_selector": css_selector
                    }
                    if tag == "INPUT":
                        elem_summary["input_type"] = input_type
                    interactive_elements.append(elem_summary)
                except Exception as e:
                    interactive_elements.append({"index": idx, "error": str(e)})
            
            return interactive_elements
            
        except Exception as e:
            logger.error(f"Error extracting interactive elements: {e}")
            return []

    def perform_ocr_on_image(self, image_path: str) -> str:
        """
        Performs OCR on an image to extract text.
        
        Args:
            image_path (str): Path to the image file
            
        Returns:
            str: Extracted text from the image
        """
        try:
            if not os.path.exists(image_path):
                return f"Error: Image file not found at {image_path}"
                
            image = Image.open(image_path)
            ocr_text = pytesseract.image_to_string(image)
            
            if not ocr_text.strip():
                return "No text detected in the image"
                
            return ocr_text
            
        except Exception as e:
            logger.error(f"Error performing OCR: {e}")
            return f"Failed to perform OCR: {e}"