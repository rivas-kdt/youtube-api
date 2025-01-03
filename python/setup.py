from setuptools import setup, find_packages

setup(
    name="hydra_youtube_api", 
    version="1.1.5",
    description="Fast and simple API for YouTube and YouTube Music", 
    long_description=open("README.md").read(), 
    long_description_content_type="text/markdown",
    url="https://github.com/Hydralerne/youtube-api",
    author="Hydra de lerne",
    author_email="hydra@onvo.me", 
    license="AGPL-3.0", 
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: GNU Affero General Public License v3",
        "Operating System :: OS Independent",
    ],
    keywords=["youtube", "music", "api", "metadata", "downloader"], 
    packages=find_packages(), 
    install_requires=[ 
        "requests",
        "aiohttp",
    ],
    python_requires=">=3.6",
    entry_points={
        "console_scripts": [
            "hydra-yt=hydra_youtube_api.cli:cli",
        ],
    },
)