# 1Password Setup Script for Helix - PowerShell Version

$op = "C:\Users\Specter\1Password\op.exe"

Write-Host "Creating Helix vault..."
& $op vault create Helix --allow-duplicate 2>$null

Write-Host "Adding secrets..."

& $op item create --vault Helix --category login --title "Supabase Service Role" `
  --url "https://supabase.co" `
  password="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jeWd1bmJ1a21wd2h0endibnZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg4MzkwNSwiZXhwIjoyMDg1NDU5OTA1fQ.e7KAirlnF1L4-0yktMzBFK6svrlYcaaP_NX1-cyoFHc" 2>$null

& $op item create --vault Helix --category login --title "Supabase Anon Key" `
  --url "https://supabase.co" `
  password="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jeWd1bmJ1a21wd2h0endibnZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4ODM5MDUsImV4cCI6MjA4NTQ1OTkwNX0.3s_zXRjITKzt_dxUxqqa-IPD4JN5jw7BbNi5br8t5QY" 2>$null

& $op item create --vault Helix --category login --title "Stripe Secret Key" `
  --url "https://stripe.com" `
  password="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" 2>$null

& $op item create --vault Helix --category login --title "Stripe Publishable Key" `
  --url "https://stripe.com" `
  password="pk_live_51SwBZdRPl2Lb1GuJtX2TQSx49wcoYlxTXQo5kbN050Ht6MR5XLCJNQVzHtV5Lnqf1CuNXJ24GWD2bIDAnEPyNp5H00vLkiyuu3" 2>$null

& $op item create --vault Helix --category login --title "DeepSeek API Key" `
  --url "https://platform.deepseek.com" `
  password="sk-30f245da32db4878bec71d56761d1786" 2>$null

& $op item create --vault Helix --category login --title "Gemini API Key" `
  --url "https://makersuite.google.com" `
  password="AIzaSyC6n0BYLJdRGSRuzjn2E-qQ-U1Qm57Qg8o" 2>$null

& $op item create --vault Helix --category secure-note --title "Discord Webhook - Commands" `
  --notes "https://discord.com/api/webhooks/1467178230833348709/xTFGPeim7XsiqqmaNlTadbMeALn1OnAxRGXgP4T526W6Bhx9fpIDpotALty242Hw9gql" 2>$null

& $op item create --vault Helix --category secure-note --title "Discord Webhook - API" `
  --notes "https://discord.com/api/webhooks/1467178251326587032/N3Ot7kkfexAj6DJL0zNTDd9ZaCXO6SaIfJnqStXai9o2Uyy4FqQd1tRID0ZOYJ4zB4rT" 2>$null

& $op item create --vault Helix --category secure-note --title "Discord Webhook - Heartbeat" `
  --notes "https://discord.com/api/webhooks/1467208129413382441/fncq-1-n-NX3NJWsJUFsN6MlZep9gnRl3EQAQ0y2ndvOTb-gFsgUbGeDCA__fVa6kXFg" 2>$null

& $op item create --vault Helix --category secure-note --title "Discord Webhook - Alerts" `
  --notes "https://discord.com/api/webhooks/1467178532986814592/dzdDiSRIEF-5Dhsm3rjE7DTA8JEDZALO6hPOlL76GGmS-Wv_2YVVmuP6XQo1okEfwqS5" 2>$null

& $op item create --vault Helix --category secure-note --title "Discord Webhook - Consciousness" `
  --notes "https://discord.com/api/webhooks/1467178482730799289/GDId7tFsRN_H2EnfiuzBdiDLwv5-FLsF04uT_Sxd-sr806cj8cQNwjsDNvb94AI_53T0" 2>$null

& $op item create --vault Helix --category secure-note --title "Discord Webhook - File Changes" `
  --notes "https://discord.com/api/webhooks/1467178425608442090/Syr7pqJjExiilAtGvjZrp9Ey0-kWQN5ue96RZtn1JewaFf2eijVeWb18pRG3NJp4uC5I" 2>$null

& $op item create --vault Helix --category secure-note --title "Discord Webhook - Hash Chain" `
  --notes "https://discord.com/api/webhooks/1467178532986814592/dzdDiSRIEF-5Dhsm3rjE7DTA8JEDZALO6hPOlL76GGmS-Wv_2YVVmuP6XQo1okEfwqS5" 2>$null

Write-Host "Done! All secrets added to 1Password"
