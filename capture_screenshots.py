"""
capture_screenshots.py - Automated Browser Screenshot Generator for Stage 3
"""

import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

os.makedirs("screenshots", exist_ok=True)

chrome_options = Options()
chrome_options.add_argument("--headless=new")
chrome_options.add_argument("--disable-gpu")
chrome_options.add_argument("--no-sandbox")
chrome_options.add_argument("--disable-dev-shm-usage")

driver = webdriver.Chrome(options=chrome_options)
wait = WebDriverWait(driver, 15)

try:
    print("[1/7] Capturing 1280px Desktop view...")
    driver.set_window_size(1280, 950)
    driver.get("http://127.0.0.1:5000/")
    wait.until(lambda d: d.execute_script("return typeof window.handleSingleScan === 'function';"))
    time.sleep(1.0)
    driver.save_screenshot("screenshots/screenshot_1280px.png")
    print("      Saved: screenshots/screenshot_1280px.png")

    print("[2/7] Capturing 768px Tablet view...")
    driver.set_window_size(768, 1024)
    driver.get("http://127.0.0.1:5000/")
    wait.until(lambda d: d.execute_script("return typeof window.handleSingleScan === 'function';"))
    time.sleep(1.0)
    driver.save_screenshot("screenshots/screenshot_768px.png")
    print("      Saved: screenshots/screenshot_768px.png")

    print("[3/7] Capturing 375px Mobile view...")
    driver.set_window_size(375, 812)
    driver.get("http://127.0.0.1:5000/")
    wait.until(lambda d: d.execute_script("return typeof window.handleSingleScan === 'function';"))
    time.sleep(1.0)
    driver.save_screenshot("screenshots/screenshot_375px.png")
    print("      Saved: screenshots/screenshot_375px.png")

    # Reset to desktop for feature screenshots
    driver.set_window_size(1280, 1100)

    print("[4/7] Capturing Safe Link result (https://google.com)...")
    driver.get("http://127.0.0.1:5000/")
    wait.until(lambda d: d.execute_script("return typeof window.handleSingleScan === 'function';"))
    url_input = driver.find_element(By.ID, "url-input")
    url_input.clear()
    url_input.send_keys("https://google.com")
    driver.execute_script("window.handleSingleScan(true);")

    # Wait for result card to appear and not have hidden class
    wait.until(lambda d: "hidden" not in d.find_element(By.ID, "single-result-card").get_attribute("class") and "state-safe" in d.find_element(By.ID, "single-result-card").get_attribute("class"))
    time.sleep(1.5)
    card = driver.find_element(By.ID, "single-result-card")
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", card)
    time.sleep(0.5)
    driver.save_screenshot("screenshots/screenshot_safe.png")
    print("      Saved: screenshots/screenshot_safe.png")

    print("[5/7] Capturing Phishing Link result (http://gooogle.com)...")
    url_input = driver.find_element(By.ID, "url-input")
    url_input.clear()
    url_input.send_keys("http://gooogle.com")
    driver.execute_script("window.handleSingleScan(true);")

    wait.until(lambda d: "hidden" not in d.find_element(By.ID, "single-result-card").get_attribute("class") and "state-phishing" in d.find_element(By.ID, "single-result-card").get_attribute("class"))
    wait.until(lambda d: "hidden" not in d.find_element(By.ID, "did-you-mean-card").get_attribute("class"))
    time.sleep(1.5)
    card = driver.find_element(By.ID, "single-result-card")
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", card)
    time.sleep(0.5)
    driver.save_screenshot("screenshots/screenshot_phishing.png")
    print("      Saved: screenshots/screenshot_phishing.png")

    print("[6/7] Capturing Chatbot conversation...")
    chat_section = driver.find_element(By.ID, "chatbot-section")
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", chat_section)
    time.sleep(0.5)

    chips = driver.find_elements(By.CSS_SELECTOR, ".quick-chip-btn")
    if chips:
        driver.execute_script("arguments[0].click();", chips[0])  # Click "Why was this flagged?"
        time.sleep(2.0)

    driver.save_screenshot("screenshots/screenshot_chatbot.png")
    print("      Saved: screenshots/screenshot_chatbot.png")

    print("[7/7] Capturing Compare Mode (google.com vs paypal-phish)...")
    driver.get("http://127.0.0.1:5000/")
    wait.until(lambda d: d.execute_script("return typeof window.handleCompareScan === 'function';"))
    time.sleep(0.5)
    tab_comp = driver.find_element(By.ID, "tab-btn-compare")
    driver.execute_script("arguments[0].click();", tab_comp)
    time.sleep(0.3)

    comp_a = driver.find_element(By.ID, "compare-url-a")
    comp_b = driver.find_element(By.ID, "compare-url-b")
    comp_a.send_keys("google.com")
    comp_b.send_keys("http://paypal.com-login-verify.secure-update.tk:8080/account")
    driver.execute_script("window.handleCompareScan(true);")

    wait.until(lambda d: "hidden" not in d.find_element(By.ID, "compare-result-container").get_attribute("class"))
    time.sleep(1.5)
    compare_container = driver.find_element(By.ID, "compare-result-container")
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", compare_container)
    time.sleep(0.5)
    driver.save_screenshot("screenshots/screenshot_compare.png")
    print("      Saved: screenshots/screenshot_compare.png")

    print("\nAll 7 screenshots successfully captured!")

finally:
    driver.quit()
