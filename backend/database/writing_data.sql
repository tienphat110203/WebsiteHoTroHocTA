-- Seed data for writing practice system

-- Insert sample writing prompts
INSERT INTO writing_prompts (prompt_name, assignment, source_text_1, difficulty_level, category, min_word_count, max_word_count)
VALUES
('Exploring Venus', 
'In "The Challenge of Exploring Venus," the author suggests studying Venus is a worthy pursuit despite the dangers it presents. Using details from the article, write an essay evaluating how well the author supports this idea.',
'The Challenge of Exploring Venus

Venus, sometimes called the "Evening Star," is one of the brightest points of light in the night sky, making it simple for even an amateur stargazer to spot. The planet has a thick atmosphere of almost 97 percent carbon dioxide blankets Venus. Even more challenging are the clouds of highly corrosive sulfuric acid in Venus''s atmosphere. On the planet''s surface, temperatures average over 800 degrees Fahrenheit, and the atmospheric pressure is 90 times greater than what we experience on our own planet. These conditions are far more extreme than anything humans encounter on Earth; such an environment would crush a submarine accustomed to diving to the deepest parts of our oceans and would liquefy many metals. Notable, Venus has the hottest surface temperature of any planet in our solar system, even though Mercury is closer to our sun.

Beyond high pressure and heat, Venusian geology and weather present additional impediments to not only human exploration but also to simple robotic missions. Erupting volcanoes, powerful earthquakes, and frequent lightning strikes to probes seeking to land on its surface contribute to the inhospitable conditions. However, peering at Venus from a ship orbiting or hovering safely above the fray is not the equivalent of a detailed study of the planet.

Astronomers are fascinated by Venus because it may well once have been the most Earth-like planet in our solar system. Long ago, Venus was probably covered largely with oceans and could have supported various forms of life, just as Earth does today. Today, Venus still has some features that are analogous to those on Earth. The planet has a surface of rocky sediment and includes familiar features such as valleys, mountains, and craters. Furthermore, recall that Venus can sometimes be seen from Earth, so Venus has value as a research subject, and a nearby laboratory for scientists who seek to understand those types of environments.

The author concludes that our travels on Earth and beyond should not be limited by dangers and doubts but should be expanded to meet the very edges of imagination and innovation. Venus would allow scientists to gain insight into a planet that shares the most characteristics with Earth within our solar system and would contribute to our knowledge about our own planet as well.',
'intermediate', 'analysis', 150, 400),

('Technology in Education',
'In "The Challenge of Exploring Venus," the author suggests studying Venus is a worthy pursuit despite the dangers it presents. Using details from the article, write an essay evaluating how well the author supports this idea.',
'Making Mona Lisa Smile

The use of technology to read the emotional expressions of students in a classroom is valuable. Students in a classroom are often bored, confused, or frustrated, and these emotions can negatively impact their learning. By using technology that can detect and analyze facial expressions, teachers can better understand how their students are feeling and adjust their teaching methods accordingly.

The Facial Action Coding System enables computers to identify human emotions by analyzing facial expressions. Dr. Huang and his colleague are experts at developing better ways for humans and computers to communicate. In fact, we humans perform this same impressive "calculation" every day. For instance, you can probably tell how a friend is feeling simply by the look on her or his face. Of course, most of us would have trouble actually describing each facial trait that conveys happy, worried, etc. Yet Dr. Huang observes that artists such as da Vinci studied human anatomy to help them paint facial expressions more accurately. "The same technology can make computer-animated faces more expressive—for videogames or video surgery," Dr. Huang predicts. "A classroom computer could recognize when a student is becoming confused or bored," Dr. Huang predicts. "Then it could modify the lesson, like an effective human instructor."

The use of this technology in classrooms could revolutionize education by providing real-time feedback about student engagement and understanding. When a computer can detect that a student is confused, it can immediately provide additional explanations or examples. When it detects boredom, it can introduce more engaging content or activities. This personalized approach to learning could help ensure that no student falls behind and that each student receives the support they need to succeed.',
'intermediate', 'argument', 150, 400),

('Driverless Cars Debate',
'Driverless cars are coming. Write an essay arguing whether the development of these cars is a positive or negative advancement for society. Use evidence from multiple perspectives to support your position.',
'Driverless Cars are Coming

The road to the truly autonomous vehicle has been long and winding, but recent advances in technology suggest that fully self-driving cars may soon become a reality. Major technology companies and automotive manufacturers are investing billions of dollars in developing autonomous vehicle technology, and several companies have already begun testing self-driving cars on public roads.

Proponents of autonomous vehicles argue that they will make roads safer by eliminating human error, which is responsible for approximately 94% of serious traffic crashes. Self-driving cars don''t get tired, distracted, or intoxicated, and they can react faster than human drivers to dangerous situations. Additionally, autonomous vehicles could provide mobility to people who are unable to drive traditional cars, such as the elderly or visually impaired.

However, critics raise concerns about the technology''s reliability and the potential consequences of system failures. They point to several high-profile accidents involving semi-autonomous vehicles as evidence that the technology is not yet ready for widespread deployment. There are also concerns about job displacement, as millions of people work as professional drivers, and about privacy and security issues related to the data collected by these vehicles.

The debate over autonomous vehicles reflects broader questions about the role of technology in society and how we balance innovation with safety and social responsibility.',
'advanced', 'argument', 200, 500),

('Social Media Impact',
'Write an essay examining the impact of social media on teenage relationships and communication. Consider both positive and negative effects in your analysis.',
'The Social Media Generation

Today''s teenagers have grown up in an era of unprecedented connectivity. Social media platforms like Instagram, TikTok, Snapchat, and Twitter have fundamentally changed how young people communicate, form relationships, and view themselves and others.

On one hand, social media has created new opportunities for connection and self-expression. Teenagers can maintain friendships across long distances, find communities of people who share their interests, and access information and support on topics that matter to them. Social media has also given young people powerful tools for creativity and activism, allowing them to share their art, organize events, and advocate for causes they believe in.

However, research has also identified concerning trends associated with heavy social media use among teenagers. Studies have linked excessive social media use to increased rates of anxiety, depression, and sleep problems among young people. The constant comparison with others'' curated online personas can lead to feelings of inadequacy and low self-esteem. Cyberbullying has emerged as a serious problem, with some teenagers experiencing harassment that follows them home through their devices.

The challenge for parents, educators, and teenagers themselves is learning how to harness the benefits of social media while minimizing its potential harms.',
'intermediate', 'analysis', 150, 400),

('Climate Change Solutions',
'Write an essay proposing practical solutions to address climate change. Support your proposals with evidence and consider potential challenges to implementation.',
'Climate Change: The Challenge of Our Time

Climate change represents one of the most pressing challenges facing humanity in the 21st century. Rising global temperatures, melting ice caps, extreme weather events, and shifting precipitation patterns are already affecting ecosystems, agriculture, and human communities around the world.

The scientific consensus is clear: human activities, particularly the burning of fossil fuels, are the primary driver of current climate change. Carbon dioxide levels in the atmosphere have increased by more than 40% since pre-industrial times, trapping heat and warming the planet at an unprecedented rate.

However, while the challenge is daunting, there are numerous solutions available that could significantly reduce greenhouse gas emissions and help mitigate the worst effects of climate change. These solutions range from technological innovations like renewable energy and electric vehicles to policy changes like carbon pricing and international cooperation agreements.

The transition to a low-carbon economy will require unprecedented global cooperation, significant investment, and changes in how we produce energy, grow food, design cities, and live our daily lives. The question is not whether we have the tools to address climate change, but whether we have the political will and social commitment to implement them at the scale and speed required.',
'advanced', 'argument', 200, 500);

-- Insert writing tips
INSERT INTO writing_tips (category, level, tip_text, example) VALUES
('general', 'all', 'Start with a clear thesis statement that directly addresses the prompt.', 'In "The Challenge of Exploring Venus," the author effectively supports the idea that studying Venus is worthwhile by presenting compelling scientific evidence and addressing potential counterarguments.'),
('general', 'all', 'Use specific examples from the text to support your arguments.', 'The author notes that "Venus has the hottest surface temperature of any planet in our solar system," which demonstrates the extreme conditions that make exploration challenging.'),
('organization', 'all', 'Use transition words to connect your ideas smoothly.', 'Furthermore, the author explains... However, critics might argue... In addition to this evidence...'),
('organization', 'beginner', 'Structure your essay with an introduction, body paragraphs, and conclusion.', 'Introduction: State your thesis\nBody: Present evidence and analysis\nConclusion: Summarize your argument'),
('content', 'intermediate', 'Address counterarguments to strengthen your position.', 'While some might argue that the dangers outweigh the benefits, the author effectively counters this by...'),
('content', 'advanced', 'Analyze the author''s rhetorical strategies and their effectiveness.', 'The author''s use of scientific data and expert testimony creates credibility, while vivid descriptions of Venus''s harsh conditions appeal to readers'' emotions.'),
('language', 'all', 'Vary your sentence structures to create more engaging writing.', 'Instead of: "Venus is hot. Venus is dangerous. Venus is hard to explore." Try: "Venus, with its extreme heat and dangerous conditions, presents significant challenges for exploration."'),
('language', 'intermediate', 'Use precise vocabulary to express your ideas clearly.', 'Instead of "good evidence," use "compelling evidence," "convincing data," or "substantial proof."'),
('conventions', 'all', 'Proofread your essay for grammar, spelling, and punctuation errors.', 'Check for common errors like subject-verb agreement, comma splices, and apostrophe usage.'),
('content', 'beginner', 'Make sure each paragraph has one main idea.', 'Each body paragraph should focus on one piece of evidence or one aspect of your argument.'),
('organization', 'intermediate', 'Use topic sentences to introduce each paragraph''s main idea.', 'The author''s first piece of evidence demonstrates... / Another way the author supports this claim is... / Finally, the author addresses counterarguments by...'),
('language', 'advanced', 'Use sophisticated vocabulary and varied sentence structures.', 'Instead of "The author says," try "The author contends," "argues," "maintains," or "asserts."'),
('conventions', 'beginner', 'Use proper capitalization and punctuation.', 'Remember to capitalize the first word of each sentence and proper nouns like "Venus" and "Earth."'),
('content', 'all', 'Support your claims with evidence from the text.', 'Don''t just state your opinion - back it up with quotes, examples, or data from the source material.');

-- Insert sample essays
INSERT INTO sample_essays (prompt_id, essay_text, score, level, feedback, word_count) VALUES
(1, 'In "The Challenge of Exploring Venus," the author presents a compelling argument that studying Venus is a worthy scientific pursuit despite the significant dangers involved. Through the use of scientific evidence, logical reasoning, and acknowledgment of counterarguments, the author effectively supports this position.

The author begins by establishing the extreme dangers of Venus exploration, noting that the planet has "temperatures average over 800 degrees Fahrenheit" and "atmospheric pressure is 90 times greater than what we experience on our own planet." These vivid details help readers understand the magnitude of the challenges involved. However, rather than using these facts to discourage exploration, the author uses them to emphasize the remarkable nature of the scientific endeavor.

The strongest support for the author''s argument comes from the scientific rationale for studying Venus. The author explains that "Venus was probably covered largely with oceans and could have supported various forms of life, just as Earth does today." This connection to Earth''s history provides a compelling reason why Venus research could benefit our understanding of our own planet. The author further strengthens this point by noting that Venus "shares the most characteristics with Earth within our solar system."

The author also acknowledges the limitations of current exploration methods, stating that "peering at Venus from a ship orbiting or hovering safely above the fray is not the equivalent of a detailed study of the planet." This honest assessment of current capabilities demonstrates the author''s credibility and shows awareness of the challenges while maintaining that they can be overcome.

In conclusion, the author effectively supports the argument for Venus exploration by balancing acknowledgment of the dangers with compelling scientific justifications. The logical progression from establishing challenges to presenting benefits creates a persuasive case for continued research efforts.', 8.5, 'intermediate', 'Strong analysis with good use of textual evidence. Well-organized with clear thesis and supporting arguments.', 267),

(2, 'Technology that can read facial expressions in classrooms would be a valuable tool for improving education. The author of "Making Mona Lisa Smile" makes a good case for why this technology could help students learn better.

The main reason this technology would be helpful is that it can tell when students are confused or bored. The author says that "a classroom computer could recognize when a student is becoming confused or bored" and "then it could modify the lesson, like an effective human instructor." This would be really useful because teachers can''t always tell how every student is feeling, especially in big classes.

Another good point the author makes is that this technology already exists and works well. The Facial Action Coding System can already identify human emotions, and the author mentions that "we humans perform this same impressive calculation every day" when we look at people''s faces. So the technology is just doing what people already do naturally.

The technology could also help make learning more personal for each student. If the computer knows a student is bored, it could make the lesson more interesting. If a student is confused, it could give more explanation. This would help make sure no student gets left behind.

Some people might worry about privacy, but the author doesn''t really talk about this. They focus more on the benefits. Overall, I think the author does a good job showing why this technology would be valuable in classrooms.', 6.2, 'beginner', 'Good basic understanding of the argument. Could use more specific examples and deeper analysis.', 218);

-- Update the database schema version
INSERT INTO system_settings (setting_key, setting_value, description) VALUES 
('writing_system_version', '1.0', 'Version of the writing practice system')
ON CONFLICT (setting_key) DO UPDATE SET 
setting_value = EXCLUDED.setting_value,
updated_at = CURRENT_TIMESTAMP;
