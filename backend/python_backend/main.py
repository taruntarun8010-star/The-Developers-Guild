from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class StudentData(BaseModel):
    name: str
    skills: list[str]


SKILL_BUCKETS = [
    {
        "key": "foundation",
        "weight": 1,
        "keywords": ["html", "css", "javascript", "js", "git", "github", "sql", "c", "c++", "cpp"],
    },
    {
        "key": "frameworks",
        "weight": 2,
        "keywords": ["react", "node", "express", "fastapi", "django", "flask", "spring", "next", "vite", "tailwind"],
    },
    {
        "key": "advanced",
        "weight": 3,
        "keywords": ["typescript", "aws", "docker", "kubernetes", "microservice", "redis", "graphql", "machine learning", "ml", "ai", "devops"],
    },
]


def guild_level_from_score(score: int) -> str:
    if score <= 4:
        return "Novice"
    if score <= 8:
        return "Apprentice"
    if score <= 13:
        return "Journeyman"
    if score <= 18:
        return "Master"
    return "Grandmaster"


def analyze_with_score(name: str, skills: list[str]) -> dict:
    normalized_skills = []
    seen = set()
    for skill in skills:
        s = str(skill).strip()
        if not s:
            continue
        lower = s.lower()
        if lower in seen:
            continue
        seen.add(lower)
        normalized_skills.append(s)

    score = 0
    matched_skills = []
    bucket_presence = set()

    for raw_skill in normalized_skills:
        lower_skill = raw_skill.lower()
        matched_bucket = None

        for bucket in SKILL_BUCKETS:
            if any(keyword in lower_skill for keyword in bucket["keywords"]):
                matched_bucket = bucket

        if matched_bucket:
            score += matched_bucket["weight"]
            bucket_presence.add(matched_bucket["key"])
            matched_skills.append({"skill": raw_skill, "bucket": matched_bucket["key"], "weight": matched_bucket["weight"]})
        else:
            score += 1
            matched_skills.append({"skill": raw_skill, "bucket": "general", "weight": 1})

    lower_all = [s.lower() for s in normalized_skills]
    has_react = any("react" in s for s in lower_all)
    has_node = any("node" in s or "express" in s for s in lower_all)
    has_python_web = any("django" in s or "flask" in s or "fastapi" in s for s in lower_all)

    diversity_bonus = 2 if len(bucket_presence) >= 3 else 0
    stack_bonus = 2 if has_react and (has_node or has_python_web) else 0
    score += diversity_bonus + stack_bonus

    guild_level = guild_level_from_score(score)
    display_name = str(name or "Developer").strip() or "Developer"
    skills_text = ", ".join(normalized_skills) if normalized_skills else "your submitted skills"

    return {
        "name": display_name,
        "guild_level": guild_level,
        "score": score,
        "score_breakdown": {
            "matchedSkills": matched_skills,
            "diversityBonus": diversity_bonus,
            "stackBonus": stack_bonus,
        },
        "analysis_basis": [
            "Each skill is weighted by complexity (foundation=1, frameworks=2, advanced=3).",
            "Diversity bonus (+2) is added for skills across at least 3 categories.",
            "Full-stack bonus (+2) is added for frontend + backend stack combinations.",
            "Final guild level is mapped from total score bands.",
        ],
        "recommendation": f"Based on your skills in {skills_text}, your score is {score} and we recommend {display_name} for the {guild_level} tier of the Developers' Guild.",
    }

@app.get("/")
def read_root():
    return {"message": "The Developers' Guild Python Backend is running!"}

@app.post("/analyze-skills")
async def analyze_skills(student: StudentData):
    return analyze_with_score(student.name, student.skills)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
