import type { Metadata } from "next";
import { Feature, JoinCta, PageBanner, prose } from "@/components/site/blocks";

export const metadata: Metadata = { title: "Our Projects" };

export default function ProjectsPage() {
  return (
    <>
      <PageBanner
        title="Our Projects"
        image="/uploads/2025/04/solar-panels-against-blue-sunny-sky-produce-green-environmentally-friendly-energy-from-sun-blue.jpg"
      />

      <Feature
        id="amar-gram-amar-shohor"
        title="Amar Gram Amar Shohor (My Village, My City)"
        eyebrow="Project 01"
        image="/uploads/elementor/thumbs/private-home-with-solar-photovoltaic-panels-mounte-2024-12-06-19-10-07-utc-1-r5ut1wc2gqprz4eq8qzvzr5h2rowzfyxas1guyc5c0.jpg"
        imageAlt="Village home with rooftop solar panels"
        reverse
      >
        <div className={prose}>
          <p>
            With years of experience and expertise, BSREA endeavoured to create
            an unique platform to turn each village into a role model for
            sustainable development in line with the Bangladesh Government’s
            ambitions. The aim is not to turn villages into cities, rather to
            ensure that the equivalent comfort and facilities of city life will
            be available in villages without harming the nature and environment.
            As a smart village, it will have all provisions of renewable energy
            and energy efficiency to ensure energy security in most efficient
            way.
          </p>
          <p>
            Bangladesh is already well acclaimed for its largest off grid solar
            programme. The proposed initiative will not only reduce internal
            migration from village to city, but also enhance quality of
            sustainable economic growth. A stakeholder event was organized by
            BSREA in April 2019 in collaboration with SREDA and development
            partners, including GIZ and IDCOL.
          </p>
        </div>
      </Feature>

      <Feature
        id="responsible-use-of-electricity"
        title="Responsible Use of Electricity"
        eyebrow="Project 02"
        image="/uploads/elementor/thumbs/solar-farm-on-greenery-tree-in-the-village-provide-2024-10-18-03-54-16-utc-1-r5ut1ve89wohnig3e8l9f9e0hdtjrqv6yndzdodji8.jpg"
        imageAlt="Solar farm in a village"
        className="bg-white"
      >
        <p className={prose}>
          Climate adaptation and protection is a leading global issue that is
          vital for a climate vulnerable country like Bangladesh. With
          Bangladesh’s ambition to become an advanced economy by 2041, BSREA is
          particularly supporting the Government towards climate change
          mitigation. In doing so, not only does BSREA promote renewable energy
          in a business viable way, but also a campaign on responsible use of
          electricity to develop an energy conscious society was launched in
          February 2018. As part of the campaign, BSREA will recognize events
          and panel discussions for sharing experience and success stories, and
          conduct public awareness programmes for quality use of electricity.
          with collective efforts, BSREA believes Bangladesh will achieve its
          development target with minimum energy consumption compared to other
          developed countries in the world.
        </p>
      </Feature>

      <Feature
        id="achieving-sdgs"
        title="Achieving SDGs"
        eyebrow="Project 03"
        image="/uploads/2025/05/solar-panel-photovoltaic-renewable-2024-11-25-03-40-29-utc-1.jpg"
        imageAlt="Solar panels"
        reverse
      >
        <p className={prose}>
          Development of renewable energy and optimum implementation of
          sustainable development goals (SDGs) are closely linked and ought to
          be propelled forward hand in hand. RE augmentation could be an
          integral driving force for achieving SDG targets, Out of 17 SDGs, Goal
          7 (ensure access to affordable, reliable, sustainable and modern
          energy for all) and goal 13 (take urgent action to combat climate
          change and its impacts) are directly linked with proper promotion of
          renewable energy sources. Yet achievement of other goals: Goal 1 (no
          poverty), Goal 2 (zero hunger), Goal 3 (ensure healthy lives and well
          being for all), Goal 5 (gender equality), Goal 6 (clean water and
          sanitation), Goal 8 (decent work and economic growth), Goal 9
          (industry, innovation and infrastructure), Goal 10 (reduce
          inequalities), Goal 11 (sustainable cities and communities), Goal 12
          (responsible consumption and production), Goal 15 (life on land) are
          also inter-related with sustainable energy promotion. BSREA promotes
          and supports the government and private sector to implement
          environment friendly energy generation towards achieving SDGs.
        </p>
      </Feature>

      <Feature
        id="green-finance"
        title="Green Finance"
        eyebrow="Project 04"
        image="/uploads/elementor/thumbs/amazing-view-from-above-solar-panels-on-green-fiel-2025-03-24-06-36-16-utc-1-r5ut1ve89wohnig3e8l9f9e0hdtjrqv6yndzdodji8.jpg"
        imageAlt="Solar panels on a green field from above"
        className="bg-white"
      >
        <p className={prose}>
          Without access to finance, commercialization of renewable energy will
          be at stake. BSREA thus advocates for Green Finance for the private
          sector of Bangladesh in order to encourage investment in renewable
          energy. In doing so, BSREA not only collaborates with Bangladesh Bank
          and other commercial banks and financial institutes but also with
          various development partners.
        </p>
      </Feature>

      <JoinCta />
    </>
  );
}
