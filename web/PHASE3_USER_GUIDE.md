# Phase 3 Feature Guide: Custom Tools, Composite Skills & Memory Synthesis

Welcome to Phase 3 of Helix! This guide covers three powerful features that extend Helix's capabilities: Custom Tools for task automation, Composite Skills for multi-step workflows, and Memory Synthesis for psychological pattern analysis.

## Table of Contents

1. [Custom Tools](#custom-tools)
2. [Composite Skills](#composite-skills)
3. [Memory Synthesis](#memory-synthesis)
4. [Common Workflows](#common-workflows)
5. [Troubleshooting](#troubleshooting)

---

## Custom Tools

Custom Tools let you create reusable functions to automate tasks and process data.

### Creating a Custom Tool

1. **Open the Tools Page**
   - Click "Tools" in the sidebar or navigate to `/tools`
   - Click "Create New Tool"

2. **Fill in Tool Details**
   - **Name**: Give your tool a descriptive name (e.g., "Summarize Text")
   - **Description**: Explain what the tool does
   - **Tags**: Add tags for easy discovery (e.g., "text", "processing", "nlp")
   - **Visibility**: Choose "Private" (only you) or "Public" (community)

3. **Write the Tool Code**
   - Write JavaScript code in the editor
   - Your code must be a function that takes parameters and returns a result
   - Example:
     ```javascript
     function summarizeText(text, wordLimit) {
       const words = text.split(' ');
       if (words.length <= wordLimit) return text;
       return words.slice(0, wordLimit).join(' ') + '...';
     }
     ```

4. **Define Input Parameters**
   - Click "Add Parameter" for each input
   - Specify name, type (string, number, boolean, array, object)
   - Mark as required or optional
   - Provide a default value if optional

5. **Set Capabilities**
   - Select which APIs your tool needs access to:
     - **math**: Math operations and calculations
     - **string**: String manipulation (split, replace, case conversion)
     - **array**: Array operations (map, filter, reduce)
     - **json**: JSON parsing and stringification
     - **object**: Object manipulation and introspection
     - **date**: Date/time operations
     - **crypto**: Encryption and hashing
   - **Note**: Your tool cannot access file systems, network, or system processes for security

6. **Test Your Tool**
   - Click "Test" to run with sample inputs
   - View the output and any errors
   - Adjust your code if needed

7. **Save the Tool**
   - Click "Save" to create the tool
   - Your tool is now ready to use!

### Using a Custom Tool

**In Code Interface:**

1. Type `/tool [tool-name]` in your message
2. Provide the required parameters
3. Helix executes the tool and shows the result

**Example:**

```
/tool summarizeText
text: "This is a long text that needs summarizing..."
wordLimit: 10
```

**In Composite Skills:**

- Add your tool as a step in a multi-step workflow (see Composite Skills section)

**Cloning Tools:**

- Find a tool you like in the marketplace
- Click "Clone" to create your own copy
- Modify and customize as needed

### Tool Best Practices

- **Keep it focused**: One tool should do one thing well
- **Handle edge cases**: Check for null, undefined, empty inputs
- **Be efficient**: Avoid infinite loops or very large data processing
- **Document parameters**: Use clear names and descriptions
- **Test thoroughly**: Run tests with various inputs before sharing

---

## Composite Skills

Composite Skills let you chain multiple tools together into multi-step workflows, passing data between steps.

### Creating a Composite Skill

1. **Open the Skills Page**
   - Click "Skills" in the sidebar or navigate to `/skills`
   - Click "Create New Skill"

2. **Name Your Skill**
   - Choose a descriptive name
   - Add tags and visibility settings

3. **Add Steps**
   - Click "Add Step" for each operation
   - For each step, specify:
     - **Step ID**: Unique identifier (e.g., "step1", "fetch_data")
     - **Tool**: Select which tool to run
     - **Input Mapping**: Map inputs using JSONPath (see below)
     - **Output Mapping**: Where to store the result
     - **Error Handling**: What to do if this step fails
     - **Condition**: Optional condition that must be true to run

4. **Data Passing with JSONPath**
   - Use JSONPath syntax to reference data between steps
   - **Syntax**: `$.step_id.output_field`
   - **Examples**:
     - `$.input.text` - refers to the input parameter "text"
     - `$.step1.result` - refers to the "result" output from step1
     - `$.step2.data.items[0]` - refers to the first item in an array

5. **Example Workflow: Text Processing Pipeline**

   ```
   Step 1: Fetch Text
   - Tool: fetchText
   - Input: { url: $.input.sourceUrl }
   - Output: $.fetched

   Step 2: Summarize
   - Tool: summarizeText
   - Input: { text: $.fetched.content, wordLimit: 50 }
   - Output: $.summary

   Step 3: Generate Tags
   - Tool: generateTags
   - Input: { text: $.summary }
   - Output: $.tags
   ```

### Running a Composite Skill

**From the UI:**

1. Click on a skill
2. Click "Run Skill"
3. Provide input values
4. Watch each step execute in order
5. View the final result

**From Code Interface:**

```
/skill Process Text
sourceUrl: "https://example.com/article"
```

### Error Handling Strategies

When defining how to handle errors in a step:

- **stop**: Stop the entire workflow if this step fails (default)
- **continue**: Skip this step but keep going with the workflow
- **retry**: Attempt the step again if it fails (up to 3 times)

### Conditional Execution

Add conditions to steps to make workflows dynamic:

- **Example condition**: `$.step1.status === "success"`
- **Syntax**: Standard JavaScript comparisons
  - `===`, `!==`, `>`, `<`, `>=`, `<=`
  - `&&` (AND), `||` (OR)
- **Use cases**:
  - Skip processing if input is invalid
  - Use different tools based on data type
  - Repeat until a condition is met

### Skill Best Practices

- **Keep steps focused**: Each step should be one logical operation
- **Meaningful step IDs**: Use descriptive names like "extract_title" not "s1"
- **Handle data transformations**: Use JSONPath correctly to map outputs
- **Test incrementally**: Test each step before adding the next
- **Document expectations**: Explain what inputs the skill expects

---

## Memory Synthesis

Memory Synthesis analyzes your conversations to detect patterns and provide insights across Helix's seven psychological layers.

### Understanding the Layers

Memory Synthesis operates across Helix's psychological architecture:

1. **Layer 1: Narrative Core** - Life story themes and consistency
2. **Layer 2: Emotional Memory** - Emotional triggers and patterns
3. **Layer 3: Relational Memory** - Relationship dynamics and attachments
4. **Layer 4: Prospective Self** - Goals, fears, and future aspirations
5. **Layer 5: Integration Rhythms** - Periodic synthesis and reconsolidation
6. **Layer 6: Transformation** - Personal change and growth
7. **Layer 7: Purpose Engine** - Life meaning and values

### Running Memory Synthesis

1. **Open Memory Synthesis**
   - Click "Memory & Synthesis" in the sidebar
   - Click "Run Synthesis"

2. **Choose Analysis Type**
   - **Emotional Patterns**: Detect emotional triggers and regulation strategies
   - **Prospective Self**: Analyze goals and aspirations
   - **Relational Memory**: Examine relationship patterns
   - **Narrative Coherence**: Check life story consistency
   - **Full Synthesis**: Complete analysis across all layers

3. **Set Time Range** (optional)
   - Analyze recent conversations: Last 7 days, 30 days, etc.
   - Or specify custom dates

4. **Schedule Recurring Synthesis** (optional)
   - Enable "Recurring" to run automatically
   - Use cron syntax to schedule:
     - `0 2 * * *` - Daily at 2 AM
     - `0 2 * * 0` - Weekly on Sunday at 2 AM
     - `0 2 1 * *` - Monthly on 1st at 2 AM
     - `0/6 * * * *` - Every 6 hours

5. **View Results**
   - Patterns detected: With confidence scores
   - Recommendations: Actionable insights
   - Evidence: Conversations that support the patterns

### Understanding Results

**Patterns:**

- Each pattern includes:
  - **Description**: What was detected
  - **Confidence**: 0-1 score (0.8+ is high confidence)
  - **Evidence**: Conversation IDs that support it
  - **Layer**: Which psychological layer it relates to

**Recommendations:**

- Categorized as:
  - **Psychological**: Understanding your mind
  - **Behavioral**: Action-oriented suggestions
  - **Relational**: For relationships
  - **Growth**: Personal development

**Confirming Patterns:**

- Click "Confirm" if the pattern matches your experience
- Add notes to personalize the analysis
- Use confirmed patterns to track personal growth

### Using Synthesis Insights

1. **Identify Patterns**: Notice recurring themes in your life
2. **Plan Growth**: Use recommendations to work on areas
3. **Track Progress**: Run synthesis regularly to see changes
4. **Share Insights**: Mark patterns public to contribute to community knowledge
5. **Integrate Learning**: Let patterns inform your goals and decisions

### Privacy & Data

- Synthesis is **always private** by default
- Your conversations are analyzed locally
- Patterns are stored securely
- You can delete any synthesis results anytime

---

## Common Workflows

### Workflow 1: Batch Text Processing

Process multiple documents efficiently:

1. Create a "Process Document" tool that:
   - Takes document text as input
   - Cleans, analyzes, and formats output

2. Create a "Batch Process" skill that:
   - Step 1: Get document list
   - Step 2-N: Process each document
   - Final Step: Combine results

3. Run the skill with a list of documents

### Workflow 2: Data Enrichment

Combine data from multiple sources:

1. Create tools for:
   - Fetching data (API calls, parsing)
   - Transforming data (cleaning, mapping)
   - Enriching data (adding context)

2. Build a skill that chains them:
   - Fetch → Transform → Enrich → Output

3. Use conditional execution to handle errors

### Workflow 3: Personal Growth Tracking

Use Memory Synthesis with Custom Tools:

1. Create tools for:
   - Analyzing goal progress
   - Generating improvement suggestions
   - Tracking emotional patterns

2. Run regular synthesis
3. Review patterns and recommendations
4. Build tools to help implement changes
5. Track progress over time

### Workflow 4: Knowledge Base Management

Extract and organize information:

1. Tools:
   - Extract keywords
   - Generate summaries
   - Create cross-references

2. Skill combines them to:
   - Process raw content
   - Extract key information
   - Generate structured output
   - Index for search

---

## Troubleshooting

### Custom Tools Issues

**My code isn't running**

- Check for syntax errors (red highlights)
- Ensure you have a `return` statement
- Test with the Test button first
- Check that all parameters are defined

**"Dangerous pattern detected"**

- Your tool uses unsafe functions
- Forbidden: eval, require, process, global, **dirname, **filename, fs, exec
- Rewrite without these functions
- Use built-in string/array/math operations instead

**Parameters aren't being passed correctly**

- Check parameter names match your code
- Ensure types match (string, number, etc.)
- Use the Test button to verify

**Tool is too slow**

- Avoid processing very large inputs
- Don't use infinite loops
- Optimize algorithms
- Consider breaking into multiple tools

### Composite Skills Issues

**Steps aren't executing in order**

- Skills always run top-to-bottom
- Check step numbers are correct
- Verify no steps are disabled

**Data isn't passing between steps**

- Double-check JSONPath syntax
- Verify previous step actually outputs the data
- Check output mapping in previous step
- Test earlier steps individually

**Skill fails at a step**

- Check the error message
- Run that step individually
- Verify input parameters are correct
- Check error handling strategy (stop/continue/retry)

**Conditional execution not working**

- Review the condition syntax
- Use valid JavaScript comparisons
- Check JSONPath references exist
- Test with simpler conditions first

**"Invalid range" in cron schedule**

- Cron syntax: `minute hour day month weekday`
- Valid ranges:
  - Minute: 0-59
  - Hour: 0-23
  - Day: 1-31
  - Month: 1-12
  - Weekday: 0-6 (0=Sunday)

### Memory Synthesis Issues

**No patterns detected**

- Might need more conversations
- Try different time range
- Check conversation content
- Some patterns need specific context

**Confidence too low**

- Patterns need multiple occurrences
- More conversations = better detection
- Run synthesis again later

**Synthesis taking too long**

- Large conversation history takes time
- First run is slower than later runs
- Try shorter time range if stuck

**Can't confirm a pattern**

- Pattern might not apply to you
- You can still note your thoughts
- Unconfirmed patterns are still useful

---

## FAQ

**Q: Can I edit a tool after creating it?**
A: Yes, click on the tool and click "Edit". Your changes don't affect existing skill that use it.

**Q: How many steps can a skill have?**
A: No hard limit, but keep it reasonable. 20+ steps gets complex. Break into multiple skills if needed.

**Q: What happens if a step times out?**
A: The entire skill stops unless you set error handling to "continue". Use timeouts wisely.

**Q: Can I share my tools and skills?**
A: Yes! Set visibility to "Public" and they appear in the community marketplace for others to clone and use.

**Q: How often should I run Memory Synthesis?**
A: Weekly or monthly is typical. Daily can provide granular tracking. Set recurring schedule for automation.

**Q: Is my data secure?**
A: Yes. Your tools execute in a sandboxed environment. Memory synthesis is private by default. All data encrypted at rest.

---

## Get Help

- **Documentation**: Browse [Developer Guide](./PHASE3_DEVELOPER_GUIDE.md)
- **Examples**: Check community tools and skills
- **Report Issues**: Use the feedback tool in Helix
- **Discord**: Connect with the community

Happy building! 🚀
