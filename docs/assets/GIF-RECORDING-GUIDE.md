# GIF Recording Guide

Record these three GIFs from the live demos. Each should be 15-25 seconds, 1200px wide, dark theme.

## demo-financial.gif (Atlas Financial)
1. Open demo.sidclaw.com
2. Type "Send a follow-up email to Sarah Johnson"
3. Show the agent pausing
4. Show the approval card appearing on the right (amber "Why This Was Flagged")
5. Click Approve
6. Show the agent continuing
7. Show the completed trace

## demo-devops.gif (Nexus DevOps)
1. Open demo-devops.sidclaw.com
2. Click "Scale user-service to 6 replicas"
3. Show the approval card with infrastructure context
4. Approve it
5. Click "Delete idle namespace" — show it blocked
6. Show the governance panel with ALLOWED, APPROVED, and BLOCKED traces

## demo-healthcare.gif (MedAssist)
1. Open demo-healthcare.sidclaw.com
2. Click "Order labs" — show approval required
3. Show the clinical context in the approval card
4. Approve the lab order
5. Click "Prescribe medication" — show it blocked by policy
6. Show the complete trace timeline

## Tips
- Use a screen recorder like Kap, CleanShot X, or OBS
- Record at 1440x900 or similar (not full screen)
- Keep under 25 seconds per GIF
- Convert to GIF with: ffmpeg -i input.mov -vf "fps=12,scale=1200:-1" -gifflags +transdiff demo.gif
- Or use gifski for better quality: gifski --fps 12 --width 1200 -o demo.gif frames/*.png
- Target file size: under 5MB per GIF for fast README loading
