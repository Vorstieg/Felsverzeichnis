way_keys = { "highway", "sac_scale", "via_ferrata_scale", "name", "ref" }

function way_function()
    local highway = Find("highway")
    local sac_scale = Find("sac_scale")

    if highway == "via_ferrata" then
        Layer("via_ferrata", false)
        Attribute("name", Find("name"))
        Attribute("via_ferrata_scale", Find("via_ferrata_scale"))
        Attribute("ref", Find("ref"))
    elseif sac_scale ~= "" and (
        highway == "path" or
        highway == "footway" or
        highway == "track" or
        highway == "bridleway" or
        highway == "steps"
    ) then
        Layer("hiking_difficulty", false)
        Attribute("sac_scale", sac_scale)
        Attribute("name", Find("name"))
        Attribute("ref", Find("ref"))
    end
end
