#!/usr/bin/env python3
"""
Content Migration Script
Migrates Hugo/Wowchemy content to Astro content collections.
"""

import os
import shutil
import re
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
HUGO_CONTENT = PROJECT_ROOT / "content"
ASTRO_CONTENT = SCRIPT_DIR.parent / "src" / "content"

def migrate_publications():
    """Migrate publication markdown files."""
    source_dir = HUGO_CONTENT / "publication"
    dest_dir = ASTRO_CONTENT / "publications"

    dest_dir.mkdir(parents=True, exist_ok=True)

    if not source_dir.exists():
        print(f"Source directory not found: {source_dir}")
        return

    count = 0
    for pub_dir in source_dir.iterdir():
        if pub_dir.is_dir():
            index_file = pub_dir / "index.md"
            if index_file.exists():
                # Use the directory name as the slug
                dest_file = dest_dir / f"{pub_dir.name}.md"

                # Read and copy content
                content = index_file.read_text(encoding='utf-8')

                # Minor transformations if needed
                # (The frontmatter should be mostly compatible)

                dest_file.write_text(content, encoding='utf-8')
                count += 1

    print(f"Migrated {count} publications")


def migrate_posts():
    """Migrate blog posts."""
    source_dir = HUGO_CONTENT / "post"
    dest_dir = ASTRO_CONTENT / "posts"

    dest_dir.mkdir(parents=True, exist_ok=True)

    if not source_dir.exists():
        print(f"Source directory not found: {source_dir}")
        return

    count = 0
    for post_item in source_dir.iterdir():
        if post_item.is_dir():
            index_file = post_item / "index.md"
            if index_file.exists():
                dest_file = dest_dir / f"{post_item.name}.md"
                content = index_file.read_text(encoding='utf-8')

                # Replace Hugo shortcodes with Astro equivalents
                content = replace_shortcodes(content)

                dest_file.write_text(content, encoding='utf-8')
                count += 1
        elif post_item.suffix == '.md':
            dest_file = dest_dir / post_item.name
            content = post_item.read_text(encoding='utf-8')
            content = replace_shortcodes(content)
            dest_file.write_text(content, encoding='utf-8')
            count += 1

    print(f"Migrated {count} posts")


def replace_shortcodes(content: str) -> str:
    """Replace Hugo shortcodes with Astro-compatible markup."""

    # Replace {{< icon name="download" pack="fas" >}} with simple text
    content = re.sub(r'\{\{<\s*icon[^>]*>\s*\}\}', '', content)

    # Replace {{< staticref "path" "newtab" >}}text{{< /staticref >}} with markdown link
    content = re.sub(
        r'\{\{<\s*staticref\s+"([^"]+)"\s*(?:"[^"]+")?\s*>\s*\}\}([^{]*)\{\{<\s*/staticref\s*>\s*\}\}',
        r'[\2](/\1)',
        content
    )

    # Replace other common shortcodes as needed
    # {{< figure ... >}}
    content = re.sub(
        r'\{\{<\s*figure\s+src="([^"]+)"[^>]*>\s*\}\}',
        r'![](\1)',
        content
    )

    return content


def copy_static_assets():
    """Copy static assets to public directory."""
    astro_public = SCRIPT_DIR.parent / "public"

    # Copy media folder
    source_media = PROJECT_ROOT / "static" / "media"
    dest_media = astro_public / "media"
    if source_media.exists():
        if dest_media.exists():
            shutil.rmtree(dest_media)
        shutil.copytree(source_media, dest_media)
        print(f"Copied media assets")

    # Copy pdfs folder
    source_pdfs = PROJECT_ROOT / "static" / "pdfs"
    dest_pdfs = astro_public / "pdfs"
    if source_pdfs.exists():
        if dest_pdfs.exists():
            shutil.rmtree(dest_pdfs)
        shutil.copytree(source_pdfs, dest_pdfs)
        print(f"Copied PDF assets")

    # Copy data folder (JSON feeds)
    source_data = PROJECT_ROOT / "static" / "data"
    dest_data = astro_public / "data"
    if source_data.exists():
        if dest_data.exists():
            shutil.rmtree(dest_data)
        shutil.copytree(source_data, dest_data)
        print(f"Copied data feeds")


def main():
    print("Starting content migration...")
    print(f"Hugo content: {HUGO_CONTENT}")
    print(f"Astro content: {ASTRO_CONTENT}")
    print()

    migrate_publications()
    migrate_posts()
    copy_static_assets()

    print()
    print("Migration complete!")


if __name__ == "__main__":
    main()
