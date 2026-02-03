# Custom Tools User Guide

## Overview

Custom Tools let you create specialized AI functions without coding. Instead of writing JavaScript, use a visual builder to define:

- **What it does** - Name and description
- **What it takes in** - Parameters (text, numbers, files, etc.)
- **What it outputs** - Result format
- **What it can access** - Permissions (read files, call APIs, etc.)

Think of it like creating a mini-app: "TextToUppercase" or "EmailValidator" or "JSONParser"—reusable functions you and your agents can use.

## When to Create Tools

Create a custom tool when you need:

**One-time automation**

- "Parse this specific format"
- "Transform data this way"
- "Validate this business rule"

**Reusable functionality**

- Multiple agents need the same logic
- You do this transformation regularly
- The logic is self-contained

**Custom logic**

- The built-in tools don't do exactly what you need
- You want to enforce specific business rules
- You need to integrate a specific API

**Examples of useful tools:**

- ✓ Email validator (validates company email format)
- ✓ Currency converter (with fixed rates)
- ✓ Text formatter (applies your style guide)
- ✓ Data normalizer (clean up messy inputs)
- ✓ JSON validator (enforce schema)

## Creating a Tool

### Step 1: Start the Tool Builder

1. Click **Custom Tools** in the sidebar
2. Click **Create Tool**
3. You'll see the tool builder form

### Step 2: Basic Information

Fill in:

**Name** (required)

- Clear, action-based name
- Examples: "Email Validator", "Text Reverser", "JSON Parser"
- ✓ Good: "Phone Number Formatter"
- ✗ Bad: "tool1" or "function"

**Description** (required)

- What does this tool do?
- Who would use it?
- Example: "Formats phone numbers to E.164 international format (e.g., +1234567890)"

**Icon** (optional)

- Single emoji to represent the tool
- ☎️ for phone tool
- 📧 for email tool
- 🔤 for text tool
- Makes it easy to identify

**Visibility** (required)

- **Private** - Only you can use it
- **Public** - Anyone can see and clone it from Marketplace

### Step 3: Define Parameters

Parameters are the inputs your tool accepts. Click **Add Parameter** for each:

**Text Parameter**

```
Name: phoneNumber
Type: Text (String)
Description: Phone number to format
Required: Yes ✓
```

**Number Parameter**

```
Name: discount
Type: Number
Description: Discount percentage (0-100)
Required: No
```

**Boolean Parameter**

```
Name: includeArea
Type: Boolean
Description: Include area code in output
Required: No (defaults to true)
```

**Object Parameter**

```
Name: person
Type: Object
Description: Person data object
Required: No
```

**Array Parameter**

```
Name: items
Type: Array
Description: List of items to process
Required: No
```

**Example: Email Validator Tool**

```
Parameter 1: Email Address
├─ Type: Text
├─ Description: Email to validate
└─ Required: Yes

Parameter 2: Check DNS
├─ Type: Boolean
├─ Description: Verify email domain exists
└─ Required: No
```

### Step 4: Write the Code

Click the **Code Editor** and write your function. Your function receives parameters and returns results:

**Basic Template**

```javascript
async function execute(params) {
  // params.parameterName contains the input
  // Do something
  // Return the result
  return {
    success: true,
    result: 'your output here',
  };
}
```

**Simple Example: Text Reverser**

```javascript
async function execute(params) {
  const reversed = params.text.split('').reverse().join('');

  return {
    result: reversed,
    length: reversed.length,
  };
}
```

**Email Validator Example**

```javascript
async function execute(params) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValid = emailRegex.test(params.email);

  return {
    email: params.email,
    isValid: isValid,
    message: isValid ? 'Valid email' : 'Invalid email format',
  };
}
```

**Number Formatter Example**

```javascript
async function execute(params) {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: params.currency || 'USD',
  });

  return {
    original: params.amount,
    formatted: formatter.format(params.amount),
  };
}
```

**JSON Validator Example**

```javascript
async function execute(params) {
  try {
    const parsed = JSON.parse(params.jsonString);
    return {
      valid: true,
      result: parsed,
      message: 'Valid JSON',
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
      message: 'Invalid JSON',
    };
  }
}
```

### Step 5: Select Capabilities

Capabilities determine what your tool can do. Choose only what you need:

**Available Capabilities:**

- **mcp:tools** - Access other custom/built-in tools ✓ (usually safe)
- **filesystem:read** - Read files from the system
  - Example: Reading configuration files
  - ⚠️ Be careful with sensitive files
- **filesystem:write** - Write files to the system
  - Example: Saving output to logs
  - ⚠️ Could overwrite important data
- **network:localhost** - Access local services (localhost:8000)
  - Example: Local database or API
  - ✓ Safe if you control the service
- **network:outbound** - Make external API calls
  - Example: Calling weather API, payment processor
  - ⚠️ Highest risk if not controlled

**Sandbox Security Levels:**

Based on your capabilities, the tool automatically gets a security level:

**Strict Sandbox** (No file/network access)

- ✓ Safest
- ✓ Pure computation (text, math, validation)
- Examples: Validators, formatters, parsers

**Standard Sandbox** (Filesystem read + localhost)

- ✓ Safe for most tools
- Can read local files and access localhost services
- Examples: Config readers, API adapters

**Permissive Sandbox** (Full access)

- ⚠️ Highest risk
- Full file and network access
- Only use if you fully trust the code

### Step 6: Test Your Tool

Before saving, test with sample data:

1. Fill in **test input** for each parameter
2. Click **Test**
3. See the **output** in the results panel

**Testing Email Validator:**

```
Input:
  email: "user@example.com"
  checkDNS: true

Output:
  {
    "email": "user@example.com",
    "isValid": true,
    "message": "Valid email"
  }
```

Keep testing until you're happy with the results.

### Step 7: Save Your Tool

Click **Save Tool**

Your tool is now:

- ✓ Saved to your account
- ✓ Available for your agents to use
- ✓ Ready for reuse
- ✓ Accessible in the Tools menu

## Using Your Tools

### In Chats

When chatting with an agent:

- The agent can suggest using your tools if relevant
- You can manually suggest: "Use my EmailValidator tool"
- Agent executes and shows the result

Example:

```
You: "Validate these email addresses for me"
Agent: "I'll use your Email Validator tool"
Tool output: "user1@company.com ✓ valid"
Agent: "All emails are valid!"
```

### In Skills

When creating multi-step workflows:

- Select your custom tools as workflow steps
- Chain them together
- Map outputs to inputs

[See Skill Composition guide for details]

### In Automations

Set tools to run automatically:

- "Every day, clean up my data with my Cleaner tool"
- "When new emails arrive, validate them"
- Scheduling and automation options coming soon

## Managing Your Tools

### View Your Tools

1. Click **Custom Tools** in sidebar
2. See all your tools:
   - Personal tools (locked icon)
   - Public tools (globe icon)
   - Recently used appear at top

### Edit a Tool

Click **Edit** on any tool to modify:

- Name, description, icon
- Parameters
- Code
- Capabilities
- Visibility

Changes take effect immediately for new uses.

### Test Again

After editing, you can:

- Click **Test** to verify your changes
- Fix any issues before others use it
- Keep previous version as reference

### Delete a Tool

Click **Delete** to remove a tool:

- Removes from your account
- No longer available to use
- Already-saved workflows are affected
- Consider archiving instead if used frequently

### Clone Someone Else's Tool

Find a tool you like in the Marketplace:

1. Click **Clone**
2. Customize for your needs
3. Save as your own version
4. Improve and optionally republish

## Tool Examples

### Email Domain Validator

Validates that email is from approved domain:

```javascript
async function execute(params) {
  const approvedDomains = ['company.com', 'company.co.uk', 'team.company.com'];

  const email = params.email.toLowerCase();
  const domain = email.split('@')[1];

  const isApproved = approvedDomains.includes(domain);

  return {
    email: params.email,
    domain: domain,
    approved: isApproved,
    message: isApproved ? `✓ ${domain} is approved` : `✗ ${domain} is not approved`,
  };
}
```

### Markdown to HTML

Converts markdown to HTML:

```javascript
async function execute(params) {
  // Simple markdown conversion
  let html = params.markdown
    .replace(/# (.*)\n/g, '<h1>$1</h1>')
    .replace(/## (.*)\n/g, '<h2>$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');

  return {
    html: html,
    length: html.length,
  };
}
```

### CSV Parser

Parses CSV text into structured data:

```javascript
async function execute(params) {
  const lines = params.csvText.split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i];
    });
    return obj;
  });

  return {
    headers: headers,
    rowCount: rows.length,
    rows: rows,
  };
}
```

### Password Strength Checker

Evaluates password security:

```javascript
async function execute(params) {
  const pwd = params.password;
  let score = 0;
  let feedback = [];

  if (pwd.length >= 8) score += 1;
  else feedback.push('Use 8+ characters');
  if (/[a-z]/.test(pwd)) score += 1;
  else feedback.push('Add lowercase letters');
  if (/[A-Z]/.test(pwd)) score += 1;
  else feedback.push('Add uppercase letters');
  if (/[0-9]/.test(pwd)) score += 1;
  else feedback.push('Add numbers');
  if (/[!@#$%^&*]/.test(pwd)) score += 1;
  else feedback.push('Add special characters');

  const strength = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'][score];

  return {
    strength: strength,
    score: score,
    feedback: feedback,
    suggestions: feedback.length > 0 ? feedback : ['Great password!'],
  };
}
```

## Best Practices

### Keep Tools Focused

**✓ Good tools:**

- Do one thing well
- Have clear purpose
- Easy to test
- Reusable

**✗ Bad tools:**

- Try to do everything
- Complex logic
- Hard to understand
- One-use only

### Write Clear Output

Always return structured results:

```javascript
// ✓ Good: Clear structure
return {
  success: true,
  result: '...',
  message: 'User-friendly message',
};

// ✗ Bad: Unclear output
return 'Something happened';
```

### Handle Errors Gracefully

```javascript
// ✓ Good: Handles errors
try {
  // Do something
  return { success: true, result: ... };
} catch (error) {
  return {
    success: false,
    error: error.message,
    message: "Something went wrong"
  };
}

// ✗ Bad: Crashes on error
return JSON.parse(untrustedData);
```

### Use Appropriate Capabilities

**Don't over-request permissions:**

```javascript
// ✗ Bad: Requests network access to format text
capabilities: ['network:outbound'];
async function execute(params) {
  return { result: params.text.toUpperCase() };
}

// ✓ Good: No unnecessary permissions
capabilities: [];
async function execute(params) {
  return { result: params.text.toUpperCase() };
}
```

### Document Parameters Well

Clear descriptions help users know what to pass:

```javascript
// ✓ Good: Clear parameter descriptions
Parameter 1: Email Address
  Description: "User email in format user@domain.com"

Parameter 2: Check MX Records
  Description: "Verify domain can receive mail (requires network access)"
```

## Troubleshooting

### Tool Not Working

**Problem:** My tool runs but gives wrong results
**Solution:**

- Test with different inputs
- Check for edge cases (empty strings, null values)
- Add debugging: console.log() shows in results
- Simplify until it works, then expand

### Tool Too Slow

**Problem:** Tool takes too long to run
**Solution:**

- Remove unnecessary loops
- Don't process huge files
- Consider breaking into smaller tools
- Cache results if reusing same inputs

### Can't Access Capabilities

**Problem:** My code tries to read files but fails
**Solution:**

- Check that "filesystem:read" capability is enabled
- Verify the file exists and path is correct
- Check permissions on the file
- Test with a simple file path first

### Parameter Errors

**Problem:** Parameters aren't being passed to function
**Solution:**

- Check parameter names match exactly (case-sensitive)
- Verify `async function execute(params)` signature
- Access with `params.parameterName`
- Test with sample data

### Tool Disappeared

**Problem:** I created a tool but can't find it
**Solution:**

- Check you're in the right workspace
- Try searching for the name
- Check if it was accidentally deleted
- Refresh the page

## Sharing Tools

### Make Tools Public

1. In tool settings, set **Visibility: Public**
2. Tool appears in Marketplace
3. Others can see, use, and clone it
4. You get credit as the creator

### Clone from Marketplace

1. Find a tool you like
2. Click **Clone**
3. Customize if needed
4. Save as your own

### Contribute Improvements

If you improve a cloned tool:

1. Save your version
2. Write notes about what changed
3. Consider publishing if a general improvement
4. Give credit to original creator

## Advanced Patterns

### Tool Composition

Use your tools from other tools:

```javascript
async function execute(params) {
  // Your EmailValidator tool is available as 'emailValidator'
  const validation = await emailValidator.run({
    email: params.email,
  });

  if (validation.isValid) {
    // Continue processing
    return { valid: true, message: 'Email validated' };
  } else {
    return { valid: false, error: validation.error };
  }
}
```

### Conditional Logic

Different outputs based on inputs:

```javascript
async function execute(params) {
  if (params.type === 'email') {
    return validateEmail(params.value);
  } else if (params.type === 'phone') {
    return validatePhone(params.value);
  } else {
    return { error: 'Unknown type' };
  }
}
```

### Batch Processing

Process multiple items:

```javascript
async function execute(params) {
  const results = params.items.map(item => {
    return {
      input: item,
      processed: item.toUpperCase(),
    };
  });

  return {
    count: results.length,
    results: results,
  };
}
```

## Summary

Custom Tools let you:

✓ Automate repetitive tasks
✓ Enforce business rules
✓ Create reusable functions
✓ Extend AI agent capabilities
✓ Share useful utilities

**Workflow:**

1. Define what it does (name, description)
2. Specify inputs (parameters)
3. Write the logic (code)
4. Set permissions (capabilities)
5. Test thoroughly
6. Save and use
7. Share if helpful

**Next steps:**

1. Identify a repetitive task you do
2. Create a custom tool for it
3. Test with real data
4. Use in your workflows
5. Consider sharing with others

Happy tooling! 🔧
